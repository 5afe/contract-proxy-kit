import should from 'should';
import Web3Maj1Min2 from 'web3-1-2';
import Web3Maj2Alpha from 'web3-2-alpha';
import CPK from '../../src';
import Web3Adapter from '../../src/eth-lib-adapters/Web3Adapter';
import { shouldSupportDifferentTransactions } from '../transactions/shouldSupportDifferentTransactions';
import { toTxHashPromise } from '../utils';
import { Address } from '../../src/utils/constants';
import { Transaction } from '../../src/utils/transactions';
import { NetworksConfig } from '../../src/utils/networks';
import { getContractInstances, TestContractInstances } from '../utils/contracts';
import {RelayProvider} from "@opengsn/gsn";
import {getAddress} from "ethers-4/utils";

interface ShouldWorkWithWeb3Props {
  Web3: typeof Web3Maj1Min2 | typeof Web3Maj2Alpha;
  gsnProvider: any;
  defaultAccountBox: Address[];
  safeOwnerBox: Address[];
  gnosisSafeProviderBox: any;
}

export function shouldWorkWithWeb3({
  Web3,
  gsnProvider,
  defaultAccountBox,
  safeOwnerBox,
  gnosisSafeProviderBox
}: ShouldWorkWithWeb3Props): void {
  describe(`with Web3 version ${(new Web3(Web3.givenProvider)).version}`, () => {

    const ueb3 = new Web3(gsnProvider);

    let contracts: TestContractInstances;

    const testHelperMaker = (web3Box: any): any => ({
      checkAddressChecksum: (address: Address): boolean => (
        web3Box[0].utils.checkAddressChecksum(address)
      ),
      sendTransaction: (txObj: any): any => (
        toTxHashPromise(web3Box[0].eth.sendTransaction(txObj))
      ),
      randomHexWord: (): string => web3Box[0].utils.randomHex(32),
      fromWei: (amount: number): number => Number(web3Box[0].utils.fromWei(amount)),
      getTransactionCount: (account: Address): number => (
        web3Box[0].eth.getTransactionCount(account)
      ),
      testedTxObjProps: 'the PromiEvent for the transaction and the hash',
      getBalance: (address: Address): number => web3Box[0].eth.getBalance(address)
        .then((balance: number) => web3Box[0].utils.toBN(balance)),
      checkTxObj: ({ promiEvent, hash }: { promiEvent: any; hash: string }): void => {
        should.exist(promiEvent);
        should.exist(hash);
      },
      waitTxReceipt: async ({ hash }: { hash: string }): Promise<any> => {
        let receipt = await web3Box[0].eth.getTransactionReceipt(hash);
        while (!receipt) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          receipt = await web3Box[0].eth.getTransactionReceipt(hash);
        }
        return receipt;
      },
    });

    const ueb3TestHelpers = testHelperMaker([ueb3]);

    before('setup contracts', async () => {
      contracts = getContractInstances();
    });

    it('should not produce ethLibAdapter instances when web3 not provided', async () => {
      ((): Web3Adapter => new Web3Adapter({} as any)).should.throw('web3 property missing from options');
    });

    it('should not produce CPK instances when web3 not connected to a recognized network', async () => {
      const ethLibAdapter = new Web3Adapter({ web3: ueb3 });
      await CPK.create({ ethLibAdapter }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks: NetworksConfig;

      before('obtain addresses from artifacts', async () => {
        const { gnosisSafe, cpkFactory, multiSend, defaultCallbackHandler } = contracts;

        networks = {
          [await ueb3.eth.net.getId()]: {
            masterCopyAddress: gnosisSafe.address,
            proxyFactoryAddress: cpkFactory.address,
            multiSendAddress: multiSend.address,
            fallbackHandlerAddress: defaultCallbackHandler.address,
          },
        };
      });

      it('can produce instances', async () => {
        const ethLibAdapter = new Web3Adapter({ web3: ueb3 });
        should.exist(ethLibAdapter);
        should.exist(await CPK.create({ ethLibAdapter, networks }));
        should.exist(await CPK.create({
          ethLibAdapter,
          networks,
          ownerAccount: defaultAccountBox[0]
        }));
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

        const ethLibAdapter = new Web3Adapter({ web3: ueb3 });
        const uninitializedCPK = new CPK({ ethLibAdapter });
        const dataHash = uninitializedCPK.encodeMultiSendCallData(transactions);

        const multiStepAddress = multiStep.address.slice(2).toLowerCase();
        dataHash.should.be.equal(`0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000f200${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf093000000000000000000000000000000000000000000000000000000000000000100${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf09300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000`);
      });

      describe('with warm instance', () => {
        let cpk: CPK;

        before('create instance', async () => {
          const ethLibAdapter = new Web3Adapter({ web3: ueb3 });
          cpk = await CPK.create({ ethLibAdapter, networks, ownerAccount: defaultAccountBox[0] });
        });

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`;
          await cpk.execTransactions([{
            to: idPrecompile,
          }]);
        });

        shouldSupportDifferentTransactions({
          web3: ueb3,
          ...ueb3TestHelpers,
          async getCPK() { return cpk; },
        });
      });

      describe('with fresh accounts', () => {
        shouldSupportDifferentTransactions({
          web3: ueb3,
          ...ueb3TestHelpers,
          async getCPK() {
            const newAccount = ueb3.eth.accounts.create();
            ueb3.eth.accounts.wallet.add(newAccount);
            //keep new accounts gasless
            // await ueb3TestHelpers.sendTransaction({
            //   from: defaultAccountBox[0],
            //   to: newAccount.address,
            //   value: `${2e18}`,
            //   gas: '0x5b8d80',
            // });

            const ethLibAdapter = new Web3Adapter({ web3: ueb3 });
            return CPK.create({
              ethLibAdapter,
              networks,
              ownerAccount: newAccount.address,
            });
          },
        });
      });

      describe.skip('with mock WalletConnected Gnosis Safe provider', () => {
        const safeWeb3Box: any[] = [];

        before('create Web3 instance', async () => {
          safeWeb3Box[0] = new Web3(gnosisSafeProviderBox[0]);
        });

        let cpk: CPK;

        before('create instance', async () => {
          const ethLibAdapter = new Web3Adapter({ web3: safeWeb3Box[0] });
          cpk = await CPK.create({ ethLibAdapter, networks });
        });

        shouldSupportDifferentTransactions({
          web3: ueb3,
          ...testHelperMaker(safeWeb3Box),
          async getCPK() { return cpk; },
          ownerIsRecognizedContract: true,
          executor: safeOwnerBox,
        });
      });
    });
  });
}
