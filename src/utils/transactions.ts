import { defaultTxData, defaultTxOperation, defaultTxValue, OperationType, Address, NumberLike } from './constants';
import { toHex } from './hex-data';

interface GasLimitOptions {
  gas?: NumberLike;
  gasLimit?: NumberLike;
}

interface BaseTxOptions extends GasLimitOptions {
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

export class TransactionError extends Error {
  revertData?: string;
  revertMessage?: string;

  constructor(message: string, revertData?: string, revertMessage?: string) {
    super(message);
    this.revertData = revertData;
    this.revertMessage = revertMessage;
  }
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

export type NormalizeGas<T> = Pick<T, Exclude<keyof T, 'gasLimit'>>

export function normalizeGasLimit<T extends GasLimitOptions>(
  options: T,
): NormalizeGas<T> {
  const { gas, gasLimit, ...rest } = options;
  if (gas != null && gasLimit != null) {
    throw new Error(`specified both gas and gasLimit on options: ${options}`);
  }
  return {
    ...rest,
    gas: gas || gasLimit,
  } as NormalizeGas<T>;
}

export function formatCallTx(tx: EthCallTx): RpcCallTx {
  const { from, to, value, data, gas } = normalizeGasLimit(tx);

  return {
    from, to,
    value: !value ? undefined : toHex(value),
    data,
    gas: !gas ? undefined : toHex(gas),
  };
}
