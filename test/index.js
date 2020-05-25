import should from 'should';
import { ethers as ethersMaj4 } from 'ethers-4';
import Web3Maj1Min2 from 'web3-1-2';
import Web3Maj2Alpha from 'web3-2-alpha';
import CPK from '../src';
import CpkTransactionManager from '../src/transactionManagers/CpkTransactionManager';
import SafeRelayTransactionManager from '../src/transactionManagers/SafeRelayTransactionManager';
import { zeroAddress } from '../src/utils/constants';
import EmulatedSafeProvider from './utils/EmulatedSafeProvider';
import shouldWorkWithWeb3 from './web3/shouldWorkWithWeb3';
import shouldWorkWithEthers from './ethers/shouldWorkWithEthers';

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const GnosisSafe = artifacts.require('GnosisSafe');
const ProxyFactory = artifacts.require('ProxyFactory');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const MultiSend = artifacts.require('MultiSend');

contract('CPK', ([coinbase, defaultAccount, safeOwner]) => {
  if (!defaultAccount) {
    defaultAccount = coinbase;
  }
  if (!safeOwner) {
    safeOwner = defaultAccount;
  }

  const gnosisSafeProviderBox = [];

  before('emulate Gnosis Safe WalletConnect provider', async () => {
    const proxyFactory = await ProxyFactory.deployed();
    const safeMasterCopy = await GnosisSafe.deployed();
    const multiSend = await MultiSend.deployed();
    const safeSetupData = safeMasterCopy.contract.methods.setup(
      [safeOwner],
      1,
      zeroAddress,
      '0x',
      DefaultCallbackHandler.address,
      zeroAddress,
      '0x',
      zeroAddress,
    ).encodeABI();
    const safeCreationTx = await proxyFactory.createProxy(safeMasterCopy.address, safeSetupData);
    const safeAddress = safeCreationTx.logs.find(({ event }) => event === 'ProxyCreation').args.proxy;
    const safeSignature = `0x000000000000000000000000${
      safeOwner.replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;
    const safe = await GnosisSafe.at(safeAddress);

    const emulatedSafeProvider = new EmulatedSafeProvider({
      safe,
      safeAddress,
      safeOwner,
      safeMasterCopy,
      multiSend,
      safeSignature,
      zeroAddress,
    });
    gnosisSafeProviderBox[0] = emulatedSafeProvider;
  });

  it('should exist', () => {
    should.exist(CPK);
  });

  it('should not produce CPK instances when options are missing', async () => {
    await CPK.create().should.be.rejectedWith('missing options');
  });

  it('should not produce CPK instances when ethLibAdapter not provided', async () => {
    await CPK.create({}).should.be.rejectedWith('ethLibAdapter property missing from options');
  });

  it('should not produce SafeRelayTransactionManager instances when url not provided', async () => {
    (() => new SafeRelayTransactionManager({})).should.throw('url property missing from options');
  });

  describe('with transaction manager CpkTransactionManager', () => {
    web3Versions.forEach((Web3) => {
      shouldWorkWithWeb3(Web3, defaultAccount, safeOwner, gnosisSafeProviderBox);
    });
    shouldWorkWithEthers(ethersMaj4, defaultAccount, safeOwner, gnosisSafeProviderBox);
  });
  
  describe('with transaction manager SafeRelayTransactionManager', () => {
    const txManager = new SafeRelayTransactionManager({ url: 'http://localhost:8000' });
    web3Versions.forEach((Web3) => {
      shouldWorkWithWeb3(Web3, defaultAccount, safeOwner, gnosisSafeProviderBox, txManager);
    });
    shouldWorkWithEthers(ethersMaj4, defaultAccount, safeOwner, gnosisSafeProviderBox, txManager);
  });
});
