const CALL = 0;
const DELEGATE_CALL = 1;

const zeroAddress = `0x${'0'.repeat(40)}`;

const defaultTxOperation = CALL;
const defaultTxValue = 0;
const defaultTxData = '0x';

// keccak256(toUtf8Bytes('Contract Proxy Kit'))
const predeterminedSaltNonce = '0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65';

module.exports = {
  CALL,
  DELEGATE_CALL,
  defaultTxOperation,
  defaultTxValue,
  defaultTxData,
  zeroAddress,
  predeterminedSaltNonce,
};
