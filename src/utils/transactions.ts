import { defaultTxData, defaultTxOperation, defaultTxValue, OperationType } from './constants';

export interface Transaction {
  data?: string;
  operation?: OperationType;
  to: string;
  value?: number;
}

interface StandardTransaction {
  data: string;
  operation: OperationType;
  to: string;
  value: number;
}

export interface SafeProviderSendTransaction {
  data: string;
  to: string;
  value: number;
}

export function standardizeTransactions(transactions: Transaction[]): StandardTransaction[] {
  return transactions.map((tx: Transaction) => ({
    data: tx.data ? tx.data : defaultTxData,
    operation: tx.operation ? tx.operation : defaultTxOperation,
    value: tx.value ? tx.value : defaultTxValue,
    ...tx
  }));
}
