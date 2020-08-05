import { OperationType, Transaction } from '../../src/utils/transactions';
import { zeroAddress } from '../../src/utils/constants';
import { Address } from '../../src/utils/basicTypes';

interface EmulatedSafeProviderProps {
  web3: any;
  safe: any;
  safeAddress: Address;
  safeOwnerBox: Address[];
  safeMasterCopy: any;
  multiSend: any;
  safeSignature: string;
}

const makeEmulatedSafeProvider: any = ({
  web3,
  safe,
  safeAddress,
  safeOwnerBox,
  safeMasterCopy,
  multiSend,
  safeSignature,
}: EmulatedSafeProviderProps) => {
  return {
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
            data: safeMasterCopy.contract.methods.execTransaction(
              to,
              value || 0,
              data,
              OperationType.Call,
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
              data: safeMasterCopy.contract.methods.execTransaction(
                to,
                value || 0,
                data,
                OperationType.Call,
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
            web3.eth.abi.encodeParameter('uint8', OperationType.Call).slice(-2),
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
          OperationType.DelegateCall,
          0,
          0,
          0,
          zeroAddress,
          zeroAddress,
          safeSignature,
          { from: safeOwnerBox[0], gas: web3.utils.toHex(3e6) },
        ).then(({ tx }: { tx: any }) => callback(null, { id, jsonrpc, result: tx }), callback);
      }

      return web3.currentProvider.send(rpcData, callback);
    },
  };
};

export default makeEmulatedSafeProvider;
