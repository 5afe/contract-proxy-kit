const should = require('should');

const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const SafeProxy = require('..');

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
    });
  });
}

describe('SafeProxy', () => {
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
