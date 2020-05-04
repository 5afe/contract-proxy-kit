import should from 'should';
import { ethers as ethersMaj4 } from 'ethers-4';
import Web3Maj1Min2 from 'web3-1-2';
import Web3Maj2Alpha from 'web3-2-alpha';
import CPK from '../src';
import { zeroAddress } from '../src/utils/constants';
import shouldWorkWithWeb3 from './web3/shouldWorkWithWeb3';
import shouldWorkWithEthers from './ethers/shouldWorkWithEthers';

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const GnosisSafe = artifacts.require('GnosisSafe');
const MultiSend = artifacts.require('MultiSend');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const ProxyFactory = artifacts.require('ProxyFactory');

contract('CPK', ([defaultAccount, safeOwner]) => {
  if (safeOwner == null) {
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
          params.forEach((tx) => {
            if (typeof tx.operation !== 'undefined') {
              throw new Error('expected operation property to be unset');
            }
          });

          const callData = multiSend.contract.methods.multiSend(
            `0x${params.map((tx) => [
              web3.eth.abi.encodeParameter('uint8', CPK.Call).slice(-2),
              web3.eth.abi.encodeParameter('address', tx.to).slice(-40),
              web3.eth.abi.encodeParameter('uint256', tx.value).slice(-64),
              web3.eth.abi.encodeParameter('uint256', web3.utils.hexToBytes(tx.data).length).slice(-64),
              tx.data.replace(/^0x/, ''),
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

  it('should not produce CPK instances when options are missing', async () => {
    await CPK.create().should.be.rejectedWith('missing options');
  });

  it('should not produce CPK instances when cpkProvider not provided', async () => {
    await CPK.create({}).should.be.rejectedWith('cpkProvider property missing from options');
  });

  web3Versions.forEach((Web3) => {
    shouldWorkWithWeb3(Web3, defaultAccount, safeOwner, gnosisSafeProviderBox);
  });
  shouldWorkWithEthers(ethersMaj4, defaultAccount, safeOwner, gnosisSafeProviderBox);
});
