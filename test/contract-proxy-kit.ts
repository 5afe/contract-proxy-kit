import should from 'should';
import { ethers as ethersMaj4 } from 'ethers-4';
import Web3Maj1Min2 from 'web3-1-2';
import Web3Maj2Alpha from 'web3-2-alpha';
import CPK from '../src';
import { zeroAddress, Address } from '../src/utils/constants';
import { shouldWorkWithWeb3 } from './web3/shouldWorkWithWeb3';
import { shouldWorkWithEthers } from './ethers/shouldWorkWithEthers';
import { Transaction } from '../src/utils/transactions';
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

describe('CPK', () => {
  let web3: any;
  const defaultAccountBox: Address[] = [];
  // let coinbase: Address;
  const safeOwnerBox: Address[] = [];
  let contracts: TestContractInstances;
  const gnosisSafeProviderBox: any[] = [];

  before('initialize user accounts', async () => {
    web3 = new Web3Maj1Min2('http://localhost:8545');
    const accounts = await web3.eth.getAccounts();

    // coinbase = accounts[0];
    defaultAccountBox[0] = accounts[1];
    safeOwnerBox[0] = accounts[2];
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
    const proxyCreationEvents = logs.find(({ event }: { event: any }) => event === 'ProxyCreation');
    const safeAddress = proxyCreationEvents && proxyCreationEvents.args.proxy;
    const safeSignature = `0x000000000000000000000000${
      safeOwnerBox[0].replace(/^0x/, '').toLowerCase()
    }000000000000000000000000000000000000000000000000000000000000000001`;
    const safe = await getContracts().GnosisSafe.at(safeAddress);

    const emulatedSafeProvider: any = {
      ...web3.currentProvider,
      wc: {
        peerMeta: {
          name: 'Gnosis Safe - Mock',
        },
      },
      send(rpcData: any, callback: any) {
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
            from, to, gasPrice, value, data, nonce,
          }] = params;

          if (from.toLowerCase() !== safeAddress.toLowerCase()) {
            return callback(new Error(`expected to be from safe address ${safeAddress} but got ${from}`));
          }

          return web3.currentProvider.send({
            id,
            jsonrpc,
            method,
            params: [{
              from: safeOwnerBox[0],
              to: safeAddress,
              // Override with 3M as gas limit in this mock provider
              // as Safe app/gas relayer ultimately has control over
              // this parameter, so we just set it to some value that
              // should allow all txs in this test suite to work.
              gas: web3.utils.toHex(3e6),
              gasPrice,
              value,
              nonce,
              data: gnosisSafe.contract.methods.execTransaction(
                to,
                value || 0,
                data,
                CPK.Call,
                0,
                0,
                0,
                zeroAddress,
                zeroAddress,
                safeSignature,
              ).encodeABI(),
            }],
          }, callback);
        }

        if (method === 'eth_getTransactionCount') {
          const [account, block] = params;
          if (account === safeAddress) {
            return web3.currentProvider.send({
              id, jsonrpc, method, params: [safeOwnerBox[0], block],
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
                from: safeOwnerBox[0],
                to: safeAddress,
                gas,
                gasPrice,
                value,
                nonce,
                data: gnosisSafe.contract.methods.execTransaction(
                  to,
                  value || 0,
                  data,
                  CPK.Call,
                  0,
                  0,
                  0,
                  zeroAddress,
                  zeroAddress,
                  safeSignature,
                ).encodeABI(),
              }],
            }, callback);
          }
        }

        if (method === 'gs_multi_send') {
          params.forEach((tx: Transaction) => {
            if (typeof tx.operation !== 'undefined') {
              throw new Error('expected operation property to be unset');
            }
          });

          const callData = multiSend.contract.methods.multiSend(
            `0x${params.map((tx: Transaction) => [
              web3.eth.abi.encodeParameter('uint8', CPK.Call).slice(-2),
              web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
              web3.eth.abi.encodeParameter('uint256', tx.value || 0).slice(-64),
              web3.eth.abi.encodeParameter('uint256', web3.utils.hexToBytes(tx.data).length).slice(-64),
              tx.data && tx.data.replace(/^0x/, ''),
            ].join('')).join('')}`,
          ).encodeABI();

          return safe.execTransaction(
            multiSend.address,
            0,
            callData,
            CPK.DelegateCall,
            0,
            0,
            0,
            zeroAddress,
            zeroAddress,
            safeSignature,
            { from: safeOwnerBox[0], gas: web3.utils.toHex(3e6) },
          ).then(({ tx }: { tx: any }) => (
            callback(null, { id, jsonrpc, result: tx }), callback)
          );
        }

        return web3.currentProvider.send(rpcData, callback);
      },
    };

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

  describe('start', () => {
    web3Versions.forEach((Web3) => {
      shouldWorkWithWeb3({ Web3, defaultAccountBox, safeOwnerBox, gnosisSafeProviderBox });
    });
    shouldWorkWithEthers({
      ethers: ethersMaj4,
      defaultAccountBox,
      safeOwnerBox,
      gnosisSafeProviderBox
    });
  });
});
