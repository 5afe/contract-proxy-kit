const GnosisSafe = artifacts.require('GnosisSafe');
const MultiSend = artifacts.require('MultiSend');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const CPKFactory = artifacts.require('CPKFactory');

const CPK = require('../..');
const shouldSupportDifferentTransactions = require('../transactions/shouldSupportDifferentTransactions')
const { defaultGasLimit, toConfirmationPromise } = require('../utils')

function shouldWorkWithEthers(ethers, defaultAccount, safeOwner, gnosisSafeProviderBox) {
  describe(`with ethers version ${ethers.version}`, () => {
    const signer = ethers.Wallet.createRandom()
      .connect(new ethers.providers.Web3Provider(web3.currentProvider));

    const ethersTestHelpers = (signerBox) => ({
      checkAddressChecksum: (address) => ethers.utils.getAddress(address) === address,
      sendTransaction: ({ from, ...txObj }) => signerBox[0].sendTransaction(txObj),
      randomHexWord: () => ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      fromWei: (amount) => Number(ethers.utils.formatUnits(amount.toString(), 'ether')),
      getTransactionCount: signer.provider.getTransactionCount.bind(signer.provider),
      getBalance: signer.provider.getBalance.bind(signer.provider),
      getGasUsed: async ({ transactionResponse }) => (
        await transactionResponse.wait()
      ).gasUsed.toNumber(),
      testedTxObjProps: 'the TransactionResponse and the hash',
      checkTxObj: ({ transactionResponse, hash }) => {
        should.exist(transactionResponse);
        should.exist(hash);
      },
    });

    it('should not produce instances when signer is missing', async () => {
      await CPK.create({ ethers }).should.be.rejectedWith('missing signer required for ethers');
    });

    it('should not produce instances when ethers not connected to a recognized network', async () => {
      await CPK.create({ ethers, signer }).should.be.rejectedWith(/unrecognized network ID \d+/);
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
        should.exist(await CPK.create({ ethers, signer, networks }));
      });

      describe('with warm instance', () => {
        let cpk;

        before('fund owner/signer', async () => {
          await toConfirmationPromise(web3.eth.sendTransaction({
            from: defaultAccount,
            to: signer.address,
            value: `${2e18}`,
            gasLimit: '0x5b8d80',
          }));
        });

        before('create instance', async () => {
          cpk = await CPK.create({ ethers, signer, networks });
        });

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`;
          await cpk.execTransactions([{
            to: idPrecompile,
          }], { gasLimit: defaultGasLimit });
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
              gasLimit: '0x5b8d80',
            }));

            return CPK.create({
              ethers,
              signer: freshSignerBox[0],
              networks,
            });
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
          cpk = await CPK.create({
            ethers,
            signer: safeSignerBox[0],
            networks,
          });
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
