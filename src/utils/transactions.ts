import { defaultTxData, defaultTxOperation, defaultTxValue } from './constants';

export const standardizeTransactions = (transactions) => transactions.map((tx) => ({
  data: tx.data ? tx.data : defaultTxData,
  operation: tx.operation ? tx.operation : defaultTxOperation,
  value: tx.value ? tx.value : defaultTxValue,
  ...tx,
}));
