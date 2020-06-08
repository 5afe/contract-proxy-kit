import should from 'should';
import Web3Maj1Min2 from 'web3-1-2';
import CPK from '../../src';
import EthersAdapter from '../../src/eth-lib-adapters/EthersAdapter';
import { shouldSupportDifferentTransactions } from '../transactions/shouldSupportDifferentTransactions';
import { toTxHashPromise } from '../utils';
import { NetworksConfig } from '../../src/utils/networks';
import { Address } from '../../src/utils/constants';
import { Transaction } from '../../src/utils/transactions';
import { getContractInstances, TestContractInstances } from '../utils/contracts';

interface ShouldWorkWithEthersProps {
  ethers: any;
  defaultAccountBox: Address[];
  safeOwnerBox: Address[];
  gnosisSafeProviderBox: any;
}

export function shouldWorkWithEthers({
  ethers,
  defaultAccountBox,
  safeOwnerBox,
  gnosisSafeProviderBox
}: ShouldWorkWithEthersProps): void {
  describe(`with ethers version ${ethers.version}`, () => {
    const web3 = new Web3Maj1Min2('ws://localhost:8545');

    let contracts: TestContractInstances;

    const signer = ethers.Wallet.createRandom()
      .connect(new ethers.providers.Web3Provider(web3.currentProvider));

    const ethersTestHelpers = (signerBox: any[]): any => ({
      checkAddressChecksum: (address: Address): boolean => (
        ethers.utils.getAddress(address) === address
      ),
      sendTransaction: async ({
        from, gas, ...txObj
      }: { from: Address; gas: number }): Promise<any> => {
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
        const nonce: number = await signer.provider.getTransactionCount(await signer.getAddress());
        const signedTx = await signer.sign({
          nonce,
          gasLimit: gas,
          ...txObj,
        });
        return signer.provider.sendTransaction(signedTx);
      },
      randomHexWord: (): string => ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      fromWei: (amount: number): number => (
        Number(ethers.utils.formatUnits(amount.toString(), 'ether'))
      ),
      getTransactionCount: (address: Address): number => (
        signer.provider.getTransactionCount(address)
      ),
      getBalance: (address: Address): number => signer.provider.getBalance(address),
      testedTxObjProps: 'the TransactionResponse and the hash',
      checkTxObj:
        ({ transactionResponse, hash }: { transactionResponse: any; hash: string }): void => {
          should.exist(transactionResponse);
          should.exist(hash);
        },
      waitTxReceipt: ({ hash }: { hash: string }): any => signer.provider.waitForTransaction(hash),
    });
   
    before('setup contracts', async () => {
      contracts = getContractInstances();
    });

    it('should not produce ethLibAdapter instances when ethers not provided', async () => {
      ((): EthersAdapter => new EthersAdapter({ signer } as any)).should.throw('ethers property missing from options');
    });

    it('should not produce ethLibAdapter instances when signer not provided', async () => {
      ((): EthersAdapter => new EthersAdapter({ ethers } as any)).should.throw('signer property missing from options');
    });
    
    it('should not produce CPK instances when ethers not connected to a recognized network', async () => {
      const ethLibAdapter = new EthersAdapter({ ethers, signer });
      await CPK.create({ ethLibAdapter }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks: NetworksConfig;

      before('obtain addresses from artifacts', async () => {
        const { gnosisSafe, cpkFactory, multiSend, defaultCallbackHandler } = contracts;

        networks = {
          [(await signer.provider.getNetwork()).chainId]: {
            masterCopyAddress: gnosisSafe.address,
            proxyFactoryAddress: cpkFactory.address,
            multiSendAddress: multiSend.address,
            fallbackHandlerAddress: defaultCallbackHandler.address,
          },
        };
      });

      it('can produce instances', async () => {
        const ethLibAdapter = new EthersAdapter({ ethers, signer });
        should.exist(ethLibAdapter);
        should.exist(await CPK.create({ ethLibAdapter, networks }));
      });

      it('can encode multiSend call data', async () => {
        const { multiStep } = contracts;
        const transactions: Transaction[] = [{
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }, {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(2).encodeABI(),
        }];

        const ethLibAdapter = new EthersAdapter({ ethers, signer });
        const uninitializedCPK = new CPK({ ethLibAdapter });
        const dataHash = uninitializedCPK.encodeMultiSendCallData(transactions);

        const multiStepAddress = multiStep.address.slice(2).toLowerCase();
        dataHash.should.be.equal(`0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000f200${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf093000000000000000000000000000000000000000000000000000000000000000100${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf09300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000`);
      });

      describe('with warm instance', () => {
        let cpk: CPK;

        before('fund owner/signer', async () => {
          await toTxHashPromise(web3.eth.sendTransaction({
            from: defaultAccountBox[0],
            to: signer.address,
            value: `${2e18}`,
            gas: '0x5b8d80',
          }));
        });

        before('create instance', async () => {
          const ethLibAdapter = new EthersAdapter({ ethers, signer });
          cpk = await CPK.create({ ethLibAdapter, networks });
        });

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`;
          await cpk.execTransactions([{
            to: idPrecompile,
          }]);
        });

        shouldSupportDifferentTransactions({
          web3,
          ...ethersTestHelpers([signer]),
          async getCPK() { return cpk; },
        });
      });

      describe('with fresh accounts', () => {
        const freshSignerBox: any[] = [];
        shouldSupportDifferentTransactions({
          web3,
          ...ethersTestHelpers(freshSignerBox),
          async getCPK() {
            freshSignerBox[0] = ethers.Wallet.createRandom()
              .connect(new ethers.providers.Web3Provider(web3.currentProvider));

            await toTxHashPromise(web3.eth.sendTransaction({
              from: defaultAccountBox[0],
              to: freshSignerBox[0].address,
              value: `${2e18}`,
              gas: '0x5b8d80',
            }));

            const ethLibAdapter = new EthersAdapter({ ethers, signer: freshSignerBox[0] });
            return CPK.create({ ethLibAdapter, networks });
          },
        });
      });

      describe('with mock WalletConnected Gnosis Safe provider', () => {
        const safeSignerBox: any[] = [];

        before('create Web3 instance', async () => {
          const provider = new ethers.providers.Web3Provider(gnosisSafeProviderBox[0]);
          safeSignerBox[0] = provider.getSigner();
        });

        let cpk: CPK;

        before('create instance', async () => {
          const ethLibAdapter = new EthersAdapter({ ethers, signer: safeSignerBox[0] });
          cpk = await CPK.create({ ethLibAdapter, networks });
        });

        shouldSupportDifferentTransactions({
          web3,
          ...ethersTestHelpers(safeSignerBox),
          async getCPK() { return cpk; },
          ownerIsRecognizedContract: true,
          executor: safeOwnerBox,
        });
      });
    });
  });
}
