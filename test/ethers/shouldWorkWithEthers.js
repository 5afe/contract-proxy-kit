import CPK from '../../src';
import CPKEthersProvider from '../../src/providers/CPKEthersProvider';
import shouldSupportDifferentTransactions from '../transactions/shouldSupportDifferentTransactions';
import { toConfirmationPromise } from '../utils';

const GnosisSafe = artifacts.require('GnosisSafe');
const MultiSend = artifacts.require('MultiSend');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const CPKFactory = artifacts.require('CPKFactory');
const Multistep = artifacts.require('Multistep');

function shouldWorkWithEthers(ethers, defaultAccount, safeOwner, gnosisSafeProviderBox) {
  describe(`with ethers version ${ethers.version}`, () => {
    const signer = ethers.Wallet.createRandom()
      .connect(new ethers.providers.Web3Provider(web3.currentProvider));

    const ethersTestHelpers = (signerBox) => ({
      checkAddressChecksum: (address) => ethers.utils.getAddress(address) === address,
      sendTransaction: async ({ from, gas, ...txObj }) => {
        const signer = signerBox[0];
        const expectedFrom = await signer.getAddress();
        if (from != null && from.toLowerCase() !== expectedFrom.toLowerCase()) {
          throw new Error(`from ${from} doesn't match signer ${expectedFrom}`);
        }

        if (signer.constructor.name === 'JsonRpcSigner') {
          // mock WalletConnected Gnosis Safe provider
          return signer.sendTransaction({ gasLimit: gas, ...txObj });
        }

        // See: https://github.com/ethers-io/ethers.js/issues/299
        const nonce = await signer.provider.getTransactionCount(await signer.getAddress());
        const signedTx = await signer.sign({
          nonce,
          gasLimit: gas,
          ...txObj,
        });
        return signer.provider.sendTransaction(signedTx);
      },
      randomHexWord: () => ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      fromWei: (amount) => Number(ethers.utils.formatUnits(amount.toString(), 'ether')),
      getTransactionCount: signer.provider.getTransactionCount.bind(signer.provider),
      getBalance: signer.provider.getBalance.bind(signer.provider),
      testedTxObjProps: 'the TransactionResponse and the hash',
      checkTxObj: ({ transactionResponse, hash }) => {
        should.exist(transactionResponse);
        should.exist(hash);
      },
      waitTxReceipt: ({ hash }) => signer.provider.waitForTransaction(hash),
    });

    let multiStep;

    before('deploy mock contracts', async () => {
      multiStep = await Multistep.new();
    });

    it('should not produce cpkProvider instances when ethers not provided', async () => {
      (() => new CPKEthersProvider({ signer })).should.throw('ethers property missing from options');
    });

    it('should not produce cpkProvider instances when signer not provided', async () => {
      (() => new CPKEthersProvider({ ethers })).should.throw('signer property missing from options');
    });

    it('should not produce CPK instances when ethers not connected to a recognized network', async () => {
      const cpkProvider = new CPKEthersProvider({ ethers, signer });
      await CPK.create({ cpkProvider }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks;

      before('obtain addresses from artifacts', async () => {
        networks = {
          [(await signer.provider.getNetwork()).chainId]: {
            masterCopyAddress: GnosisSafe.address,
            proxyFactoryAddress: CPKFactory.address,
            multiSendAddress: MultiSend.address,
            fallbackHandlerAddress: DefaultCallbackHandler.address,
          },
        };
      });

      it('can produce instances', async () => {
        const cpkProvider = new CPKEthersProvider({ ethers, signer });
        should.exist(cpkProvider);
        should.exist(await CPK.create({ cpkProvider, networks }));
      });

      it('can encode multiSend call data', async () => {
        const transactions = [{
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }, {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(2).encodeABI(),
        }];

        const cpkProvider = new CPKEthersProvider({ ethers, signer });
        const dataHash = cpkProvider.encodeMultiSendCallData(transactions);

        const multiStepAddress = multiStep.address.slice(2).toLowerCase();
        dataHash.should.be.equal(`0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000f200${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf093000000000000000000000000000000000000000000000000000000000000000100${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf09300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000`);
      });

      describe('with warm instance', () => {
        let cpk;

        before('fund owner/signer', async () => {
          await toConfirmationPromise(web3.eth.sendTransaction({
            from: defaultAccount,
            to: signer.address,
            value: `${2e18}`,
            gas: '0x5b8d80',
          }));
        });

        before('create instance', async () => {
          const cpkProvider = new CPKEthersProvider({ ethers, signer });
          cpk = await CPK.create({ cpkProvider, networks });
        });

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`;
          await cpk.execTransactions([{
            to: idPrecompile,
          }]);
        });

        shouldSupportDifferentTransactions({
          ...ethersTestHelpers([signer]),
          async getCPK() { return cpk; },
        });
      });

      describe('with fresh accounts', () => {
        const freshSignerBox = [];
        shouldSupportDifferentTransactions({
          ...ethersTestHelpers(freshSignerBox),
          async getCPK() {
            freshSignerBox[0] = ethers.Wallet.createRandom()
              .connect(new ethers.providers.Web3Provider(web3.currentProvider));

            await toConfirmationPromise(web3.eth.sendTransaction({
              from: defaultAccount,
              to: freshSignerBox[0].address,
              value: `${2e18}`,
              gas: '0x5b8d80',
            }));

            const cpkProvider = new CPKEthersProvider({ ethers, signer: freshSignerBox[0] });
            return CPK.create({ cpkProvider, networks });
          },
        });
      });

      describe('with mock WalletConnected Gnosis Safe provider', () => {
        const safeSignerBox = [];

        before('create Web3 instance', async () => {
          const provider = new ethers.providers.Web3Provider(gnosisSafeProviderBox[0]);
          safeSignerBox[0] = provider.getSigner();
        });

        let cpk;

        before('create instance', async () => {
          const cpkProvider = new CPKEthersProvider({ ethers, signer: safeSignerBox[0] });
          cpk = await CPK.create({ cpkProvider, networks });
        });

        shouldSupportDifferentTransactions({
          ...ethersTestHelpers(safeSignerBox),
          async getCPK() { return cpk; },
          ownerIsRecognizedContract: true,
          executor: safeOwner,
        });
      });
    });
  });
}

module.exports = shouldWorkWithEthers;
