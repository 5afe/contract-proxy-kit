const GnosisSafe = artifacts.require('GnosisSafe');
const MultiSend = artifacts.require('MultiSend');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const CPKFactory = artifacts.require('CPKFactory');

const CPK = require('../..');
const shouldSupportDifferentTransactions = require('../transactions/shouldSupportDifferentTransactions');
const { defaultGasLimit, toConfirmationPromise } = require('../utils');

function shouldWorkWithWeb3(Web3, defaultAccount, safeOwner, gnosisSafeProviderBox) {
  describe(`with Web3 version ${(new Web3()).version}`, () => {
    const ueb3 = new Web3(web3.currentProvider);

    const testHelperMaker = (web3Box) => ({
      checkAddressChecksum: (address) => web3Box[0].utils.checkAddressChecksum(address),
      sendTransaction: (txObj) => toConfirmationPromise(web3Box[0].eth.sendTransaction(txObj)),
      randomHexWord: () => web3Box[0].utils.randomHex(32),
      fromWei: (amount) => Number(web3Box[0].utils.fromWei(amount)),
      getTransactionCount: (account) => web3Box[0].eth.getTransactionCount(account),
      testedTxObjProps: 'the PromiEvent for the transaction and the hash',
      getBalance: (address) => web3Box[0].eth.getBalance(address)
        .then((balance) => web3Box[0].utils.toBN(balance)),
      getGasUsed: ({ promiEvent }) => new Promise(
        (resolve, reject) => promiEvent
          .on('confirmation', (confNumber, receipt) => resolve(receipt.gasUsed))
          .on('error', reject),
      ),
      checkTxObj: ({ promiEvent, hash }) => {
        should.exist(promiEvent);
        should.exist(hash);
      },
    });

    const ueb3TestHelpers = testHelperMaker([ueb3]);

    it('should not produce instances when web3 not connected to a recognized network', async () => {
      await CPK.create({ web3: ueb3 }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks;

      before('obtain addresses from artifacts', async () => {
        networks = {
          [await ueb3.eth.net.getId()]: {
            masterCopyAddress: GnosisSafe.address,
            proxyFactoryAddress: CPKFactory.address,
            multiSendAddress: MultiSend.address,
            fallbackHandlerAddress: DefaultCallbackHandler.address,
          },
        };
      });

      it('can produce instances', async () => {
        should.exist(await CPK.create({ web3: ueb3, networks }));
      });

      describe('with warm instance', () => {
        let cpk;

        before('create instance', async () => {
          cpk = await CPK.create({ web3: ueb3, networks });
        });

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`;
          await cpk.execTransactions([{
            to: idPrecompile,
          }], { gasLimit: defaultGasLimit });
        });

        shouldSupportDifferentTransactions({
          ...ueb3TestHelpers,
          async getCPK() { return cpk; },
        });
      });

      describe('with fresh accounts', () => {
        shouldSupportDifferentTransactions({
          ...ueb3TestHelpers,
          async getCPK() {
            const newAccount = ueb3.eth.accounts.create();
            ueb3.eth.accounts.wallet.add(newAccount);
            await ueb3TestHelpers.sendTransaction({
              from: defaultAccount,
              to: newAccount.address,
              value: `${2e18}`,
              gasLimit: '0x5b8d80',
            });

            return CPK.create({
              web3: ueb3,
              networks,
              ownerAccount: newAccount.address,
            });
          },
        });
      });

      describe('with mock WalletConnected Gnosis Safe provider', () => {
        const safeWeb3Box = [];

        before('create Web3 instance', async () => {
          safeWeb3Box[0] = new Web3(gnosisSafeProviderBox[0]);
        });

        let cpk;

        before('create instance', async () => {
          cpk = await CPK.create({
            web3: safeWeb3Box[0],
            networks,
          });
        });

        shouldSupportDifferentTransactions({
          ...testHelperMaker(safeWeb3Box),
          async getCPK() { return cpk; },
          ownerIsRecognizedContract: true,
          executor: safeOwner,
        });
      });
    });
  });
}

module.exports = shouldWorkWithWeb3;
