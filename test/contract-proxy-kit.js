const should = require('should');
const { ethers: ethersMaj4 } = require('ethers-4');
const Web3Maj1Min2 = require('web3-1-2');
const Web3Maj2Alpha = require('web3-2-alpha');

const web3Versions = [Web3Maj1Min2, Web3Maj2Alpha];

const GnosisSafe = artifacts.require('GnosisSafe');
const MultiSend = artifacts.require('MultiSend');
const DefaultCallbackHandler = artifacts.require('DefaultCallbackHandler');
const ProxyFactory = artifacts.require('ProxyFactory');

const CPK = require('..');

const { zeroAddress } = require('../src/utils/constants');
const shouldWorkWithWeb3 = require('./web3/shouldWorkWithWeb3');
const shouldWorkWithEthers = require('./ethers/shouldWorkWithEthers');

contract('CPK', ([defaultAccount, safeOwner]) => {
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
                CPK.CALL,
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
                  CPK.CALL,
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
              web3.eth.abi.encodeParameter('uint8', CPK.CALL).slice(-2),
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
            CPK.DELEGATECALL,
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
