const should = require('should');

const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');

const makeConditionalTokensIdHelpers = require('@gnosis.pm/conditional-tokens-contracts/utils/id-helpers');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const SafeProxy = require('..');

const Multistep = artifacts.require('Multistep');
const ConditionalTokens = artifacts.require('ConditionalTokens');
const ERC20Mintable = artifacts.require('ERC20Mintable');

function shouldWorkWithWeb3(Web3) {
  describe(`with Web3 version ${(new Web3()).version}`, () => {
    const ueb3 = new Web3(web3.currentProvider);
    const { getConditionId } = makeConditionalTokensIdHelpers(ueb3.utils);

    it('should not produce instances when web3 not connected to a recognized network', async () => {
      await SafeProxy.create({ web3: ueb3 }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks;

      before('obtain addresses from artifacts', async () => {
        networks = {
          [await ueb3.eth.net.getId()]: {
            masterCopyAddress: artifacts.require('GnosisSafe').address,
            proxyFactoryAddress: artifacts.require('SafeProxyFactory').address,
            multiSendAddress: artifacts.require('MultiSend').address,
            callbackHandlerAddress: artifacts.require('DefaultCallbackHandler').address,
          },
        };
      });

      it('can produce instances', async () => {
        should.exist(await SafeProxy.create({ web3: ueb3, networks }));
      });

      function shouldSupportDifferentTransactions({ getSafeProxy }) {
        it('can get checksummed address of instance', async () => {
          const safeProxy = await getSafeProxy();
          should.exist(safeProxy.address);
          ueb3.utils.checkAddressChecksum(safeProxy.address).should.be.true();
        });

        describe('with mock contracts', () => {
          let safeProxy;
          let proxyOwner;

          beforeEach('rebind symbols', async () => {
            safeProxy = await getSafeProxy();
            proxyOwner = await safeProxy.getOwnerAccount();
            console.log(proxyOwner);
          });

          let conditionalTokens;
          let multiStep;
          let erc20;

          before('deploy conditional tokens', async () => {
            conditionalTokens = await ConditionalTokens.new();
          });

          beforeEach('deploy mock contracts', async () => {
            multiStep = await Multistep.new();
            erc20 = await ERC20Mintable.new();
            await erc20.mint(proxyOwner, `${1e20}`);
          });

          beforeEach('give proxy ERC20 allowance', async () => {
            await ueb3.eth.sendTransaction({
              from: proxyOwner,
              to: erc20.address,
              value: 0,
              gas: '6000000',
              data: erc20.contract.methods.approve(safeProxy.address, `${1e20}`).encodeABI(),
            });
          });

          it('can execute a single transaction', async () => {
            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(0);

            await safeProxy.execTransactions([{
              operation: SafeProxy.CALL,
              to: multiStep.address,
              value: 0,
              data: multiStep.contract.methods.doStep(1).encodeABI(),
            }]);
            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(1);
          });

          it('can batch transactions together', async () => {
            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(0);

            await safeProxy.execTransactions([
              {
                operation: SafeProxy.CALL,
                to: multiStep.address,
                value: 0,
                data: multiStep.contract.methods.doStep(1).encodeABI(),
              }, {
                operation: SafeProxy.CALL,
                to: multiStep.address,
                value: 0,
                data: multiStep.contract.methods.doStep(2).encodeABI(),
              },
            ]);
            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(2);
          });

          it('can batch ERC20 transactions', async () => {
            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(0);

            await safeProxy.execTransactions([
              {
                operation: SafeProxy.CALL,
                to: erc20.address,
                value: 0,
                data: erc20.contract.methods.transferFrom(proxyOwner, safeProxy.address, `${3e18}`).encodeABI(),
              },
              {
                operation: SafeProxy.CALL,
                to: erc20.address,
                value: 0,
                data: erc20.contract.methods.approve(multiStep.address, `${3e18}`).encodeABI(),
              },
              {
                operation: SafeProxy.CALL,
                to: multiStep.address,
                value: 0,
                data: multiStep.contract.methods.doStep(1).encodeABI(),
              },
              {
                operation: SafeProxy.CALL,
                to: multiStep.address,
                value: 0,
                data: multiStep.contract.methods.doERC20Step(2, erc20.address).encodeABI(),
              },
            ]);

            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(2);
            ueb3.utils.fromWei(await erc20.balanceOf(safeProxy.address)).should.equal('1');
            ueb3.utils.fromWei(await erc20.balanceOf(multiStep.address)).should.equal('2');
            ueb3.utils.fromWei(await erc20.balanceOf(proxyOwner)).should.equal('97');
          });

          it('can batch ERC-1155 token interactions', async () => {
            const questionId = ueb3.utils.randomHex(32);
            const conditionId = getConditionId(safeProxy.address, questionId, 2);

            await safeProxy.execTransactions([
              {
                operation: SafeProxy.CALL,
                to: erc20.address,
                value: 0,
                data: erc20.contract.methods.transferFrom(proxyOwner, safeProxy.address, `${3e18}`).encodeABI(),
              },
              {
                operation: SafeProxy.CALL,
                to: erc20.address,
                value: 0,
                data: erc20.contract.methods.approve(conditionalTokens.address, `${1e18}`).encodeABI(),
              },
              {
                operation: SafeProxy.CALL,
                to: conditionalTokens.address,
                value: 0,
                data: conditionalTokens.contract.methods.prepareCondition(
                  safeProxy.address,
                  questionId,
                  2,
                ).encodeABI(),
              },
              {
                operation: SafeProxy.CALL,
                to: conditionalTokens.address,
                value: 0,
                data: conditionalTokens.contract.methods.splitPosition(
                  erc20.address,
                  `0x${'0'.repeat(64)}`,
                  conditionId,
                  [1, 2],
                  `${1e18}`,
                ).encodeABI(),
              },
            ]);

            ueb3.utils.fromWei(await erc20.balanceOf(safeProxy.address)).should.equal('2');
            ueb3.utils.fromWei(await erc20.balanceOf(conditionalTokens.address)).should.equal('1');
            ueb3.utils.fromWei(await erc20.balanceOf(proxyOwner)).should.equal('97');
          });
        });
      }

      describe('with warm instance', () => {
        let safeProxy;

        before('create instance', async () => {
          safeProxy = await SafeProxy.create({ web3: ueb3, networks });
        });

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`;
          await safeProxy.execTransactions([{
            operation: SafeProxy.CALL,
            to: idPrecompile,
            value: 0,
            data: '0x',
          }]);
        });

        shouldSupportDifferentTransactions({
          async getSafeProxy() { return safeProxy; },
        });
      });

      describe('with fresh accounts', () => {
        shouldSupportDifferentTransactions({
          async getSafeProxy() {
            const firstAccount = (await ueb3.eth.getAccounts())[0];
            const newAccount = ueb3.eth.accounts.create();
            ueb3.eth.accounts.wallet.add(newAccount);
            await ueb3.eth.sendTransaction({
              from: firstAccount,
              to: newAccount.address,
              value: `${1e18}`,
            });

            return SafeProxy.create({
              web3: ueb3,
              networks,
              ownerAccount: newAccount.address,
            });
          },
        });
      });
    });
  });
}

contract('SafeProxy', () => {
  it('should exist', () => {
    should.exist(SafeProxy);
  });

  it('should not produce instances when options are missing', async () => {
    await SafeProxy.create().should.be.rejectedWith('missing options');
  });

  it('should not produce instances when web3 not provided', async () => {
    await SafeProxy.create({}).should.be.rejectedWith('web3 property missing from options');
  });

  web3Versions.forEach((Web3) => { shouldWorkWithWeb3(Web3); });
});
