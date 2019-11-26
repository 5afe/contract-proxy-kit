const should = require('should');

const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');
const { ethers: ethersMaj4 } = require('ethers-4');

const makeConditionalTokensIdHelpers = require('@gnosis.pm/conditional-tokens-contracts/utils/id-helpers');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const SafeProxy = require('..');

const Multistep = artifacts.require('Multistep');
const ConditionalTokens = artifacts.require('ConditionalTokens');
const ERC20Mintable = artifacts.require('ERC20Mintable');

const toConfirmationPromise = (promievent) => new Promise(
  (resolve, reject) => promievent.on('confirmation',
    (confirmationNumber, receipt) => resolve(receipt)).catch(reject),
);


function shouldSupportDifferentTransactions({
  getSafeProxy,
  checkAddressChecksum,
  sendTransaction,
  randomHexWord,
  fromWei,
}) {
  const { getConditionId } = makeConditionalTokensIdHelpers(web3.utils);

  it('can get checksummed address of instance', async () => {
    const safeProxy = await getSafeProxy();
    should.exist(safeProxy.address);
    checkAddressChecksum(safeProxy.address).should.be.true();
  });

  describe('with mock contracts', () => {
    let safeProxy;
    let proxyOwner;

    beforeEach('rebind symbols', async () => {
      safeProxy = await getSafeProxy();
      proxyOwner = await safeProxy.getOwnerAccount();
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
      fromWei(await erc20.balanceOf(safeProxy.address)).should.equal(1);
      fromWei(await erc20.balanceOf(multiStep.address)).should.equal(2);
      fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97);
    });

    it('can batch ERC-1155 token interactions', async () => {
      const questionId = randomHexWord();
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

      fromWei(await erc20.balanceOf(safeProxy.address)).should.equal(2);
      fromWei(await erc20.balanceOf(conditionalTokens.address)).should.equal(1);
      fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97);
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
    };

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
          ...ueb3TestHelpers,
          async getSafeProxy() { return safeProxy; },
        });
      });

      describe('with fresh accounts', () => {
        shouldSupportDifferentTransactions({
          ...ueb3TestHelpers,
          async getSafeProxy() {
            const newAccount = ueb3.eth.accounts.create();
            ueb3.eth.accounts.wallet.add(newAccount);
            await ueb3TestHelpers.sendTransaction({
              from: defaultAccount,
              to: newAccount.address,
              value: `${2e18}`,
              gasLimit: '0x5b8d80',
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

function shouldWorkWithEthers(ethers, defaultAccount) {
  describe(`with ethers version ${ethers.version}`, () => {
    const signer = ethers.Wallet.createRandom()
      .connect(new ethers.providers.Web3Provider(web3.currentProvider));

    const ethersTestHelpers = (signerBox) => ({
      checkAddressChecksum: (address) => ethers.utils.getAddress(address) === address,
      sendTransaction: ({ from, ...txObj }) => signerBox[0].sendTransaction(txObj),
      randomHexWord: () => ethers.utils.hexlify(ethers.utils.randomBytes(32)),
      fromWei: (amount) => Number(ethers.utils.formatUnits(amount.toString(), 'ether')),
    });

    it('should not produce instances when signer is missing', async () => {
      await SafeProxy.create({ ethers }).should.be.rejectedWith('missing signer required for ethers');
    });

    it('should not produce instances when ethers not connected to a recognized network', async () => {
      await SafeProxy.create({ ethers, signer }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks;

      before('obtain addresses from artifacts', async () => {
        networks = {
          [(await signer.provider.getNetwork()).chainId]: {
            masterCopyAddress: artifacts.require('GnosisSafe').address,
            proxyFactoryAddress: artifacts.require('SafeProxyFactory').address,
            multiSendAddress: artifacts.require('MultiSend').address,
            callbackHandlerAddress: artifacts.require('DefaultCallbackHandler').address,
          },
        };
      });

      it('can produce instances', async () => {
        should.exist(await SafeProxy.create({ ethers, signer, networks }));
      });

      describe('with warm instance', () => {
        let safeProxy;

        before('fund owner/signer', async () => {
          await toConfirmationPromise(web3.eth.sendTransaction({
            from: defaultAccount,
            to: signer.address,
            value: `${2e18}`,
            gasLimit: '0x5b8d80',
          }));
        });

        before('create instance', async () => {
          safeProxy = await SafeProxy.create({ ethers, signer, networks });
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
          ...ethersTestHelpers([signer]),
          async getSafeProxy() { return safeProxy; },
        });
      });

      describe('with fresh accounts', () => {
        const freshSignerBox = [];
        shouldSupportDifferentTransactions({
          ...ethersTestHelpers(freshSignerBox),
          async getSafeProxy() {
            freshSignerBox[0] = ethers.Wallet.createRandom()
              .connect(new ethers.providers.Web3Provider(web3.currentProvider));

            await toConfirmationPromise(web3.eth.sendTransaction({
              from: defaultAccount,
              to: freshSignerBox[0].address,
              value: `${2e18}`,
              gasLimit: '0x5b8d80',
            }));

            return SafeProxy.create({
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

contract('SafeProxy', ([defaultAccount]) => {
  it('should exist', () => {
    should.exist(SafeProxy);
  });

  it('should not produce instances when options are missing', async () => {
    await SafeProxy.create().should.be.rejectedWith('missing options');
  });

  it('should not produce instances when web3/ethers not provided', async () => {
    await SafeProxy.create({}).should.be.rejectedWith('web3/ethers property missing from options');
  });

  web3Versions.forEach((Web3) => { shouldWorkWithWeb3(Web3, defaultAccount); });
  shouldWorkWithEthers(ethersMaj4, defaultAccount);
});
