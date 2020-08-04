import should from 'should';
import { ethers as ethersMaj4 } from 'ethers-4';
import { ethers as ethersMaj5 } from 'ethers-5';
import Web3Maj1Min2 from 'web3-1-2';
import Web3Maj2Alpha from 'web3-2-alpha';
import CPK from '../src';
import { zeroAddress } from '../src/utils/constants';
import { Address } from '../src/utils/basicTypes';
import SafeRelayTransactionManager from '../src/transactionManagers/SafeRelayTransactionManager';
import EmulatedSafeProvider from './utils/EmulatedSafeProvider';
import { shouldWorkWithWeb3 } from './web3/shouldWorkWithWeb3';
import { shouldWorkWithEthers } from './ethers/shouldWorkWithEthers';
import {
  initializeContracts,
  getContracts,
  getContractInstances,
  TestContractInstances
} from './utils/contracts';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];
const ethersVersions = [ethersMaj4, ethersMaj5];

describe('CPK', () => {
  let web3: any;
  const defaultAccountBox: Address[] = [];
  const safeOwnerBox: Address[] = [];
  let contracts: TestContractInstances;
  const gnosisSafeProviderBox: any[] = [];

  before('initialize user accounts', async () => {
    web3 = new Web3Maj1Min2('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();

    // First account is used as the Safe relayer account
    defaultAccountBox[0] = accounts[2];
    safeOwnerBox[0] = accounts[3];
  });
  
  before('initialize contracts', async () => {
    await initializeContracts(safeOwnerBox[0]);
    contracts = getContractInstances();
  });

  before('emulate Gnosis Safe WalletConnect provider', async () => {
    const { gnosisSafe, defaultCallbackHandler, proxyFactory, multiSend } = contracts;
    const safeSetupData = gnosisSafe.contract.methods.setup(
      [safeOwnerBox[0]],
      1,
      zeroAddress,
      '0x',
      defaultCallbackHandler.address,
      zeroAddress,
      '0x',
      zeroAddress
    ).encodeABI();
    const { logs } = await proxyFactory.createProxy(
      gnosisSafe.address,
      safeSetupData,
      { from: safeOwnerBox[0] }
    );
    const proxyCreationEvents = (
      logs.find(({ event }: { event: any }) => event === 'ProxyCreation')
    );
    const safeAddress: Address = proxyCreationEvents && proxyCreationEvents.args.proxy;
    const safeSignature = `0x000000000000000000000000${
      safeOwnerBox[0].replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;
    const safe = await getContracts().GnosisSafe.at(safeAddress);
    const emulatedSafeProvider = new EmulatedSafeProvider({
      web3,
      safe,
      safeAddress,
      safeOwnerBox,
      safeMasterCopy: gnosisSafe,
      multiSend,
      safeSignature,
    });
    gnosisSafeProviderBox[0] = emulatedSafeProvider;
  });

  it('should exist', () => {
    should.exist(CPK);
  });

  it('should not produce CPK instances when options are missing', async () => {
    await CPK.create(undefined as any).should.be.rejectedWith('missing options');
  });

  it('should not produce CPK instances when ethLibAdapter not provided', async () => {
    await CPK.create({} as any).should.be.rejectedWith('ethLibAdapter property missing from options');
  });

  it('should not produce SafeRelayTransactionManager instances when url not provided', async () => {
    (() => new SafeRelayTransactionManager({} as any)).should.throw('url property missing from options');
  });

  describe('with CPK transaction manager', () => {
    web3Versions.forEach((Web3) => {
      shouldWorkWithWeb3({
        Web3,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox
      });
    });
    ethersVersions.forEach((ethers) => {
      shouldWorkWithEthers({
        ethers,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox,
      });
    });
  });

  describe('with Safe Relay transaction manager', () => {
    const transactionManager = new SafeRelayTransactionManager({ url: 'http://localhost:8000' });
    web3Versions.forEach((Web3) => {
      shouldWorkWithWeb3({
        Web3,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox,
        transactionManager
      });
    });
    ethersVersions.forEach((ethers) => {
      shouldWorkWithEthers({
        ethers,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox,
        transactionManager,
      });
    });
  });
});
