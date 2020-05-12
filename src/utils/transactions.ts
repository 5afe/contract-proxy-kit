import { defaultTxData, defaultTxOperation, defaultTxValue, OperationType, Address, NumberLike } from './constants';
import { toHex } from './hex-data';

interface BaseTxOptions {
  gas?: NumberLike;
  gasLimit?: NumberLike;
  gasPrice?: NumberLike;
}

export interface ExecOptions extends BaseTxOptions {
  nonce?: NumberLike;
}

export interface CallOptions extends BaseTxOptions {
  from?: Address;
}

export interface SendOptions extends ExecOptions {
  from: Address;
}

export interface EthTx {
  to: string;
  value?: NumberLike;
  data?: string;
}

export interface EthCallTx extends EthTx, CallOptions {}

export interface EthSendTx extends EthTx, SendOptions {}

export interface Transaction extends EthTx {
  operation?: OperationType;
}

export interface TransactionResult {
  hash: string;
}

export interface StandardTransaction {
  operation: OperationType;
  to: Address;
  value: number;
  data: string;
}

export function standardizeTransaction(tx: Transaction): StandardTransaction {
  return {
    operation: tx.operation ? tx.operation : defaultTxOperation,
    to: tx.to,
    value: tx.value ? Number(tx.value.toString()) : defaultTxValue,
    data: tx.data ? tx.data : defaultTxData,
  };
}

export interface RpcCallTx {
  from?: Address;
  to: Address;
  gas?: string;
  gasPrice?: string;
  value?: string;
  data?: string;
}

export function formatCallTx(tx: EthCallTx): RpcCallTx {
  const formattedTx: RpcCallTx = { to: tx.to };
  if (tx.from != null) formattedTx.from = tx.from;
  if (tx.to != null) formattedTx.to = tx.to;
  if (tx.gas != null) {
    if (tx.gasLimit != null)
      throw new Error(`specified both gas and gasLimit on eth_call params: ${
        JSON.stringify(tx, null, 2)
      }`);
    formattedTx.gas = toHex(tx.gas);
  } else if (tx.gasLimit != null) {
    formattedTx.gas = toHex(tx.gasLimit);
  }
  if (tx.value != null) {
    formattedTx.value = toHex(tx.value);
  }
  if (tx.data != null) {
    formattedTx.data = tx.data;
  }

  return formattedTx;
}
