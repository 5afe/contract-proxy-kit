const should = require('should');

const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const SafeProxy = require('..');

const Multistep = artifacts.require('Multistep');
const ERC20Mintable = artifacts.require('ERC20Mintable');

function shouldWorkWithWeb3(Web3) {
  describe(`with Web3 version ${(new Web3()).version}`, () => {
    let ueb3;
    before('initialize web3 instance with injected global web3 provider', async () => {
      ueb3 = new Web3(web3.currentProvider);
    });

    it('should not produce instances when web3 not connected to a recognized network', async () => {
      await SafeProxy.create({ web3: ueb3 }).should.be.rejectedWith(/unrecognized network ID \d+/);
    });

    describe('with valid networks configuration', () => {
      let networks;

      before('obtain addresses from artifacts', async () => {
        networks = {
          [await ueb3.eth.net.getId()]: {
            masterCopyAddress: artifacts.require('GnosisSafe').address,
            proxyFactoryAddress: artifacts.require('ProxyFactory').address,
            multiSendAddress: artifacts.require('MultiSend').address,
          },
        };
      });

      it('can produce instances', async () => {
        should.exist(await SafeProxy.create({ web3: ueb3, networks }));
      });

      describe('with an instance', () => {
        let safeProxy;
        let proxyOwner;

        before('create instance', async () => {
          safeProxy = await SafeProxy.create({ web3: ueb3, networks });
          proxyOwner = await safeProxy.getOwnerAccount();
        });

        it('can get checksummed address of instance', () => {
          should.exist(safeProxy.address);
          ueb3.utils.checkAddressChecksum(safeProxy.address).should.be.true();
        });

        describe('with mock contracts', () => {
          let multiStep;
          let erc20;

          beforeEach('deploy mock contracts', async () => {
            multiStep = await Multistep.new();
            erc20 = await ERC20Mintable.new();
            await erc20.mint(proxyOwner, `${1e20}`);
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
            await erc20.approve(safeProxy.address, `${1e20}`, { from: proxyOwner });

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
              }, {
                operation: SafeProxy.CALL,
                to: multiStep.address,
                value: 0,
                data: multiStep.contract.methods.doERC20Step(2, erc20.address).encodeABI(),
              },
            ]);

            (await multiStep.lastStepFinished(safeProxy.address)).toNumber().should.equal(2);
            web3.utils.fromWei(await erc20.balanceOf(safeProxy.address)).should.equal('1');
            web3.utils.fromWei(await erc20.balanceOf(multiStep.address)).should.equal('2');
            web3.utils.fromWei(await erc20.balanceOf(proxyOwner)).should.equal('97');
          });
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
