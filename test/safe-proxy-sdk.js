const should = require('should');

const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const SafeProxy = require('..');

const Multistep = artifacts.require('Multistep');

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

        before('create instance', async () => {
          safeProxy = await SafeProxy.create({ web3: ueb3, networks });
        });

        it('can get checksummed address of instance', () => {
          should.exist(safeProxy.address);
          ueb3.utils.checkAddressChecksum(safeProxy.address).should.be.true();
        });

        it('can execute a single transaction', async () => {
          const multiStep = await Multistep.new();
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
          const multiStep = await Multistep.new();
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
