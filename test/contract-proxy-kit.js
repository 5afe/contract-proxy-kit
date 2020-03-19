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

const GnosisSafe = artifacts.require('GnosisSafe');
const CPKFactory = artifacts.require('CPKFactory');
const MultiSend = artifacts.require('MultiSend');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const ProxyFactory = artifacts.require('ProxyFactory');
const zeroAddress = `0x${'0'.repeat(40)}`;
// TODO: remove requirement to put this parameter in the test cases:
//       should estimate gas when gas is not provided to CPK
const defaultGasLimit = '0x100000';

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
        operation: CPK.CALL,
        to: multiStep.address,
        value: 0,
        data: multiStep.contract.methods.doStep(1).encodeABI(),
      }], { gasLimit: defaultGasLimit });
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
      ], { gasLimit: defaultGasLimit });
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
      ], { gasLimit: defaultGasLimit });

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
      ], { gasLimit: defaultGasLimit });

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
      const ownerAccount = await cpk.getOwnerAccount();
      const startingTransactionCount = await getTransactionCount(ownerAccount);

      await cpk.execTransactions([{
        operation: CPK.CALL,
        to: multiStep.address,
        value: 0,
        data: multiStep.contract.methods.doStep(2).encodeABI(),
      }], { gasLimit: defaultGasLimit }).should.be.rejectedWith(/must do the next step/);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);
      await getTransactionCount(ownerAccount)
        .should.eventually.equal(startingTransactionCount);
    });

    (
      ownerIsRecognizedContract ? it.skip : it
    )('by default errors without transacting when any transaction in batch would fail', async () => {
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
      ], { gasLimit: defaultGasLimit }).should.be.rejectedWith(/(proxy creation and )?transaction execution expected to fail/);

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
      }], { gasLimit: defaultGasLimit }));
    });

    it('can execute a single transaction with a specific gas price', async () => {
      const ownerAccount = await cpk.getOwnerAccount();
      const startingBalance = await getBalance(executor || ownerAccount);

      (await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0);

      const gasPrice = 123;
      const txObj = await cpk.execTransactions(
        [{
          operation: CPK.CALL,
          to: multiStep.address,
          value: 0,
          data: multiStep.contract.methods.doStep(1).encodeABI(),
        }],
        { gasPrice, gasLimit: defaultGasLimit },
      );
      const gasUsed = await getGasUsed(txObj);

      const endingBalance = await getBalance(executor || ownerAccount);
      const gasCosts = startingBalance.sub(endingBalance).toNumber();

      gasCosts.should.be.equal(gasPrice * gasUsed);
    });

    (
      ownerIsRecognizedContract ? it.skip : it
    )('can execute a batch transaction with a specific gas price', async () => {
      const ownerAccount = await cpk.getOwnerAccount();
      const startingBalance = await getBalance(executor || ownerAccount);

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
        { gasPrice, gasLimit: defaultGasLimit },
      );
      const gasUsed = await getGasUsed(txObj);

      const endingBalance = await getBalance(executor || ownerAccount);
      const gasCosts = startingBalance.sub(endingBalance).toNumber();

      gasCosts.should.be.equal(gasPrice * gasUsed);
    });
  });
}


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
            operation: CPK.CALL,
            to: idPrecompile,
            value: 0,
            data: '0x',
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
            operation: CPK.CALL,
            to: idPrecompile,
            value: 0,
            data: '0x',
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

contract('CPK', ([defaultAccount, safeOwner]) => {
  const gnosisSafeProviderBox = [];
  before('emulate Gnosis Safe WalletConnect provider', async () => {
    const proxyFactory = await ProxyFactory.deployed();
    const safeMasterCopy = await GnosisSafe.deployed();
    const multiSend = await MultiSend.deployed();
    const safeSetupData = safeMasterCopy.contract.methods.setup(
      [safeOwner], 1,
      zeroAddress, '0x',
      DefaultCallbackHandler.address,
      zeroAddress, '0x', zeroAddress,
    ).encodeABI();
    const safeCreationTx = await proxyFactory.createProxy(safeMasterCopy.address, safeSetupData);
    const safeAddress = safeCreationTx.logs.find(({ event }) => event === 'ProxyCreation').args.proxy;
    const safeSignature = `0x000000000000000000000000${
      safeOwner.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;
    const safe = await GnosisSafe.at(safeAddress);

    const emulatedSafeProvider = {
      ...web3.currentProvider,
      wc: {
        peerMeta: {
          name: 'Gnosis Safe - Mock',
        },
      },
      send(rpcData, callback) {
        const {
          id, jsonrpc, method, params,
        } = rpcData;

        if (method === 'eth_accounts') {
          return callback(null, {
            id, jsonrpc, result: [safeAddress],
          });
        }

        if (method === 'eth_sendTransaction') {
          const [{
            from, to, gas, gasPrice, value, data, nonce,
          }] = params;

          if (from.toLowerCase() !== safeAddress.toLowerCase()) {
            return callback(new Error(`expected to be from safe address ${safeAddress} but got ${from}`));
          }

          return web3.currentProvider.send({
            id,
            jsonrpc,
            method,
            params: [{
              from: safeOwner,
              to: safeAddress,
              gas,
              gasPrice,
              value,
              nonce,
              data: safeMasterCopy.contract.methods.execTransaction(
                to, value || 0, data, CPK.CALL,
                0, 0, 0, zeroAddress, zeroAddress, safeSignature,
              ).encodeABI(),
            }],
          }, callback);
        }

        if (method === 'eth_getTransactionCount') {
          const [account, block] = params;
          if (account === safeAddress) {
            return web3.currentProvider.send({
              id, jsonrpc, method, params: [safeOwner, block],
            }, callback);
          }
        }

        if (method === 'eth_estimateGas') {
          const [{
            from, to, gas, gasPrice, value, data, nonce,
          }] = params;

          if (from.toLowerCase() === safeAddress.toLowerCase()) {
            return web3.currentProvider.send({
              id,
              jsonrpc,
              method,
              params: [{
                from: safeOwner,
                to: safeAddress,
                gas,
                gasPrice,
                value,
                nonce,
                data: safeMasterCopy.contract.methods.execTransaction(
                  to, value || 0, data, CPK.CALL,
                  0, 0, 0, zeroAddress, zeroAddress, safeSignature,
                ).encodeABI(),
              }],
            }, callback);
          }
        }

        if (method === 'gs_multi_send') {
          params.forEach((tx) => {
            if (typeof tx.operation !== 'undefined') {
              throw new Error('expected operation property to be unset');
            }
          });

          const callData = multiSend.contract.methods.multiSend(
            `0x${params.map((tx) => [
              web3.eth.abi.encodeParameter('uint8', CPK.CALL).slice(-2),
              web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
              web3.eth.abi.encodeParameter('uint256', tx.value).slice(-64),
              web3.eth.abi.encodeParameter('uint256', web3.utils.hexToBytes(tx.data).length).slice(-64),
              tx.data.replace(/^0x/, ''),
            ].join('')).join('')}`,
          ).encodeABI();

          return safe.execTransaction(
            multiSend.address, 0, callData, CPK.DELEGATECALL,
            0, 0, 0, zeroAddress, zeroAddress, safeSignature,
            { from: safeOwner },
          ).then((result) => callback(null, { id, jsonrpc, result }), callback);
        }

        return web3.currentProvider.send(rpcData, callback);
      },
    };

    gnosisSafeProviderBox[0] = emulatedSafeProvider;
  });

  it('should exist', () => {
    should.exist(CPK);
  });

  it('should not produce instances when options are missing', async () => {
    await CPK.create().should.be.rejectedWith('missing options');
  });

  it('should not produce instances when web3/ethers not provided', async () => {
    await CPK.create({}).should.be.rejectedWith('web3/ethers property missing from options');
  });

  web3Versions.forEach((Web3) => {
    shouldWorkWithWeb3(Web3, defaultAccount, safeOwner, gnosisSafeProviderBox);
  });
  shouldWorkWithEthers(ethersMaj4, defaultAccount, safeOwner, gnosisSafeProviderBox);
});
