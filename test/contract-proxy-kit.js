const should = require('should');

const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');
const { ethers: ethersMaj4 } = require('ethers-4');

const makeConditionalTokensIdHelpers = require('@gnosis.pm/conditional-tokens-contracts/utils/id-helpers');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const CPK = require('..');

const Multistep = artifacts.require('Multistep');
const ConditionalTokens = artifacts.require('ConditionalTokens');
const ERC20Mintable = artifacts.require('ERC20Mintable');

const toConfirmationPromise = (promiEvent) => new Promise(
  (resolve, reject) => promiEvent.on('confirmation',
    (confirmationNumber, receipt) => resolve(receipt)).catch(reject),
);


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
}) {
  const { getConditionId } = makeConditionalTokensIdHelpers(web3.utils);

  it('can get checksummed address of instance', async () => {
    const cpk = await getCPK();
    should.exist(cpk.address);
    checkAddressChecksum(cpk.address).should.be.true();
  });

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
        operation: CPK.CALL,
        to: multiStep.address,
        value: 0,
        data: multiStep.contract.methods.doStep(1).encodeABI(),
      }]);
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(1);
    });

    it('can batch transactions together', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      await cpk.execTransactions([
        {
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }, {
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(2).encodeABI(),
        },
      ]);
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(2);
    });

    it('can batch ERC20 transactions', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      await cpk.execTransactions([
        {
          operation: CPK.CALL,
          to: erc20.address,
          value: 0,
          data: erc20.contract.methods.transferFrom(proxyOwner, cpk.address, `${3e18}`).encodeABI(),
        },
        {
          operation: CPK.CALL,
          to: erc20.address,
          value: 0,
          data: erc20.contract.methods.approve(multiStep.address, `${3e18}`).encodeABI(),
        },
        {
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        },
        {
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doERC20Step(2, erc20.address).encodeABI(),
        },
      ]);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(2);
      fromWei(await erc20.balanceOf(cpk.address)).should.equal(1);
      fromWei(await erc20.balanceOf(multiStep.address)).should.equal(2);
      fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97);
    });

    it('can batch ERC-1155 token interactions', async () => {
      const questionId = randomHexWord();
      const conditionId = getConditionId(cpk.address, questionId, 2);

      await cpk.execTransactions([
        {
          operation: CPK.CALL,
          to: erc20.address,
          value: 0,
          data: erc20.contract.methods.transferFrom(proxyOwner, cpk.address, `${3e18}`).encodeABI(),
        },
        {
          operation: CPK.CALL,
          to: erc20.address,
          value: 0,
          data: erc20.contract.methods.approve(conditionalTokens.address, `${1e18}`).encodeABI(),
        },
        {
          operation: CPK.CALL,
          to: conditionalTokens.address,
          value: 0,
          data: conditionalTokens.contract.methods.prepareCondition(
            cpk.address,
            questionId,
            2,
          ).encodeABI(),
        },
        {
          operation: CPK.CALL,
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

      fromWei(await erc20.balanceOf(cpk.address)).should.equal(2);
      fromWei(await erc20.balanceOf(conditionalTokens.address)).should.equal(1);
      fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97);
    });

    it('by default errors without transacting when single transaction would fail', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      const ownerAccount = await cpk.getOwnerAccount();
      const startingTransactionCount = await getTransactionCount(ownerAccount);

      await cpk.execTransactions([{
        operation: CPK.CALL,
        to: multiStep.address,
        value: 0,
        data: multiStep.contract.methods.doStep(2).encodeABI(),
      }]).should.be.rejectedWith(/must do the next step/);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      await getTransactionCount(ownerAccount)
        .should.eventually.equal(startingTransactionCount);
    });

    it('by default errors without transacting when any transaction in batch would fail', async () => {
      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      const ownerAccount = await cpk.getOwnerAccount();
      const startingTransactionCount = await getTransactionCount(ownerAccount);

      await cpk.execTransactions([
        {
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }, {
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(3).encodeABI(),
        },
      ]).should.be.rejectedWith(/(proxy creation and )?transaction execution expected to fail/);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      await getTransactionCount(ownerAccount)
        .should.eventually.equal(startingTransactionCount);
    });

    it(`returns an object with ${testedTxObjProps} when doing a transaction`, async () => {
      checkTxObj(await cpk.execTransactions([{
        operation: CPK.CALL,
        to: multiStep.address,
        value: 0,
        data: multiStep.contract.methods.doStep(1).encodeABI(),
      }]));
    });

    it('can execute a single transaction with a specific gas price', async () => {
      const ownerAccount = await cpk.getOwnerAccount();
      const startingBalance = await getBalance(ownerAccount);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      const gasPrice = 123;
      const txObj = await cpk.execTransactions(
        [{
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }],
        { gasPrice },
      );
      const gasUsed = getGasUsed(txObj);

      const endingBalance = await getBalance(ownerAccount);
      const gasCosts = startingBalance.sub(endingBalance).toNumber();

      gasCosts.should.be.equal(gasPrice * gasUsed);
    });

    it('can execute a batch transaction with a specific gas price', async () => {
      const ownerAccount = await cpk.getOwnerAccount();
      const startingBalance = await getBalance(ownerAccount);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      const gasPrice = 123;
      const txObj = await cpk.execTransactions(
        [
          {
            operation: CPK.CALL,
            to: multiStep.address,
            value: 0,
            data: multiStep.contract.methods.doStep(1).encodeABI(),
          }, {
            operation: CPK.CALL,
            to: multiStep.address,
            value: 0,
            data: multiStep.contract.methods.doStep(2).encodeABI(),
          },
        ],
        { gasPrice },
      );
      const gasUsed = getGasUsed(txObj);

      const endingBalance = await getBalance(ownerAccount);
      const gasCosts = startingBalance.sub(endingBalance).toNumber();

      gasCosts.should.be.equal(gasPrice * gasUsed);
    });
  });
}


function shouldWorkWithWeb3(Web3, defaultAccount) {
  describe(`with Web3 version ${(new Web3()).version}`, () => {
    const ueb3 = new Web3(web3.currentProvider);

    const ueb3TestHelpers = {
      checkAddressChecksum: ueb3.utils.checkAddressChecksum,
      sendTransaction: (txObj) => toConfirmationPromise(ueb3.eth.sendTransaction(txObj)),
      randomHexWord: () => ueb3.utils.randomHex(32),
      fromWei: (amount) => Number(ueb3.utils.fromWei(amount)),
      getTransactionCount: ueb3.eth.getTransactionCount,
      testedTxObjProps: 'the PromiEvent for the transaction and the receipt',
      getBalance: (address) => ueb3.eth.getBalance(address)
        .then((balance) => ueb3.utils.toBN(balance)),
      getGasUsed: ({ receipt }) => receipt.gasUsed,

      checkTxObj: ({ promiEvent, receipt }) => {
        should.exist(promiEvent);
        should.exist(receipt);
      },
    };

    it('should not produce instances when web3 not connected to a recognized network', async () => {
      await CPK.create({ web3: ueb3 }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks;

      before('obtain addresses from artifacts', async () => {
        networks = {
          [await ueb3.eth.net.getId()]: {
            masterCopyAddress: artifacts.require('GnosisSafe').address,
            proxyFactoryAddress: artifacts.require('CPKFactory').address,
            multiSendAddress: artifacts.require('MultiSend').address,
            fallbackHandlerAddress: artifacts.require('DefaultCallbackHandler').address,
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
            operation: CPK.CALL,
            to: idPrecompile,
            value: 0,
            data: '0x',
          }]);
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
    });
  });
}

function shouldWorkWithEthers(ethers, defaultAccount) {
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
      getGasUsed: ({ transactionReceipt }) => transactionReceipt.gasUsed.toNumber(),
      testedTxObjProps: 'the TransactionResponse and the TransactionReceipt',
      checkTxObj: ({ transactionResponse, transactionReceipt }) => {
        should.exist(transactionResponse);
        should.exist(transactionReceipt);
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
            masterCopyAddress: artifacts.require('GnosisSafe').address,
            proxyFactoryAddress: artifacts.require('CPKFactory').address,
            multiSendAddress: artifacts.require('MultiSend').address,
            fallbackHandlerAddress: artifacts.require('DefaultCallbackHandler').address,
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
            operation: CPK.CALL,
            to: idPrecompile,
            value: 0,
            data: '0x',
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
    });
  });
}

contract('CPK', ([defaultAccount]) => {
  it('should exist', () => {
    should.exist(CPK);
  });

  it('should not produce instances when options are missing', async () => {
    await CPK.create().should.be.rejectedWith('missing options');
  });

  it('should not produce instances when web3/ethers not provided', async () => {
    await CPK.create({}).should.be.rejectedWith('web3/ethers property missing from options');
  });

  web3Versions.forEach((Web3) => { shouldWorkWithWeb3(Web3, defaultAccount); });
  shouldWorkWithEthers(ethersMaj4, defaultAccount);
});
