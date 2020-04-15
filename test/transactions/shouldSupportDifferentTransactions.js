import makeConditionalTokensIdHelpers from '@gnosis.pm/conditional-tokens-contracts/utils/id-helpers';
import { defaultGasLimit } from '../utils';

const Multistep = artifacts.require('Multistep');
const ConditionalTokens = artifacts.require('ConditionalTokens');
const ERC20Mintable = artifacts.require('ERC20Mintable');

function shouldSupportDifferentTransactions({
  getCPK,
  checkAddressChecksum,
  sendTransaction,
  randomHexWord,
  fromWei,
  getTransactionCount,
  getBalance,
  getGasUsed,
  testedTxObjProps,
  checkTxObj,
  ownerIsRecognizedContract,
  executor,
}) {
  const { getConditionId } = makeConditionalTokensIdHelpers(web3.utils);

  it('can get checksummed address of instance', async () => {
    const cpk = await getCPK();
    should.exist(cpk.address);
    checkAddressChecksum(cpk.address).should.be.true();
  });

  if (ownerIsRecognizedContract) {
    it('has same owner as instance\'s address', async () => {
      const cpk = await getCPK();
      const proxyOwner = await cpk.getOwnerAccount();
      proxyOwner.should.be.equal(cpk.address);
    });
  }

  describe('with mock contracts', () => {
    let cpk;
    let proxyOwner;

    beforeEach('rebind symbols', async () => {
      cpk = await getCPK();
      proxyOwner = await cpk.getOwnerAccount();
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
      await sendTransaction({
        from: proxyOwner,
        to: erc20.address,
        value: 0,
        gasLimit: '0x5b8d80',
        data: erc20.contract.methods.approve(cpk.address, `${1e20}`).encodeABI(),
      });
    });

    it('can execute a single transaction', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      await cpk.execTransactions([{
        to: multiStep.address,
        data: multiStep.contract.methods.doStep(1).encodeABI(),
      }]);
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(1);
    });

    it('can batch transactions together', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      await cpk.execTransactions([
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }, {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(2).encodeABI(),
        },
      ]);
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(2);
    });

    it('can batch ERC20 transactions', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      await cpk.execTransactions([
        {
          to: erc20.address,
          data: erc20.contract.methods.transferFrom(proxyOwner, cpk.address, `${3e18}`).encodeABI(),
        },
        {
          to: erc20.address,
          data: erc20.contract.methods.approve(multiStep.address, `${3e18}`).encodeABI(),
        },
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        },
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doERC20Step(2, erc20.address).encodeABI(),
        },
      ]);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(2);

      if (cpk.address === proxyOwner) {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(98);
      } else {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(1);
        fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97);
      }
      fromWei(await erc20.balanceOf(multiStep.address)).should.equal(2);
    });

    it('can batch ERC-1155 token interactions', async () => {
      const questionId = randomHexWord();
      const conditionId = getConditionId(cpk.address, questionId, 2);

      await cpk.execTransactions([
        {
          to: erc20.address,
          data: erc20.contract.methods.transferFrom(proxyOwner, cpk.address, `${3e18}`).encodeABI(),
        },
        {
          to: erc20.address,
          data: erc20.contract.methods.approve(conditionalTokens.address, `${1e18}`).encodeABI(),
        },
        {
          to: conditionalTokens.address,
          data: conditionalTokens.contract.methods.prepareCondition(
            cpk.address,
            questionId,
            2,
          ).encodeABI(),
        },
        {
          to: conditionalTokens.address,
          data: conditionalTokens.contract.methods.splitPosition(
            erc20.address,
            `0x${'0'.repeat(64)}`,
            conditionId,
            [1, 2],
            `${1e18}`,
          ).encodeABI(),
        },
      ]);

      if (cpk.address === proxyOwner) {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(99);
      } else {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(2);
        fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97);
      }
      fromWei(await erc20.balanceOf(conditionalTokens.address)).should.equal(1);
    });

    it('by default errors without transacting when single transaction would fail', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      const startingTransactionCount = await getTransactionCount(proxyOwner);

      await cpk.execTransactions([{
        to: multiStep.address,
        data: multiStep.contract.methods.doStep(2).encodeABI(),
      }]).should.be.rejectedWith(/must do the next step/);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      await getTransactionCount(proxyOwner)
        .should.eventually.equal(startingTransactionCount);
    });

    (
      ownerIsRecognizedContract ? it.skip : it
    )('by default errors without transacting when any transaction in batch would fail', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      const startingTransactionCount = await getTransactionCount(proxyOwner);

      await cpk.execTransactions([
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }, {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(3).encodeABI(),
        },
      ]).should.be.rejectedWith(/(proxy creation and )?transaction execution expected to fail/);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      await getTransactionCount(proxyOwner)
        .should.eventually.equal(startingTransactionCount);
    });

    it(`returns an object with ${testedTxObjProps} when doing a transaction`, async () => {
      checkTxObj(await cpk.execTransactions([{
        to: multiStep.address,
        data: multiStep.contract.methods.doStep(1).encodeABI(),
      }]));
    });

    it('can execute a single transaction with a specific gas price', async () => {
      const startingBalance = await getBalance(executor || proxyOwner);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      const gasPrice = 123;
      const txObj = await cpk.execTransactions(
        [{
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }],
        { gasPrice },
      );
      const gasUsed = await getGasUsed(txObj);

      const endingBalance = await getBalance(executor || proxyOwner);
      const gasCosts = startingBalance.sub(endingBalance).toNumber();

      gasCosts.should.be.equal(gasPrice * gasUsed);
    });

    (
      ownerIsRecognizedContract ? it.skip : it
    )('can execute a batch transaction with a specific gas price', async () => {
      const startingBalance = await getBalance(executor || proxyOwner);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      const gasPrice = 123;
      const txObj = await cpk.execTransactions(
        [
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI(),
          }, {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(2).encodeABI(),
          },
        ],
        { gasPrice },
      );
      const gasUsed = await getGasUsed(txObj);

      const endingBalance = await getBalance(executor || proxyOwner);
      const gasCosts = startingBalance.sub(endingBalance).toNumber();

      gasCosts.should.be.equal(gasPrice * gasUsed);
    });
  });
}

module.exports = shouldSupportDifferentTransactions;
