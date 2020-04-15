export enum OperationType {
  CALL, // 0
  DELEGATE_CALL // 1
}

export const zeroAddress = `0x${'0'.repeat(40)}`;

export const defaultTxOperation = OperationType.CALL;
export const defaultTxValue = 0;
export const defaultTxData = '0x';

// keccak256(toUtf8Bytes('Contract Proxy Kit'))
export const predeterminedSaltNonce = '0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65';
