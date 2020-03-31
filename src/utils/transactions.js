const { defaultTxData, defaultTxOperation, defaultTxValue } = require('./constants');

const standarizeTransactions = (transactions) => transactions.map((tx) => ({
  data: tx.data ? tx.data : defaultTxData,
  operation: tx.operation ? tx.operation : defaultTxOperation,
  value: tx.value ? tx.value : defaultTxValue,
  ...tx,
}));


module.exports = {
  standarizeTransactions,
};
