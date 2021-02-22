import { OperationType } from './transactions'

export const zeroAddress = `0x${'0'.repeat(40)}`

export const sentinelModules = '0x0000000000000000000000000000000000000001'

export const defaultTxOperation = OperationType.Call
export const defaultTxValue = '0x0'
export const defaultTxData = '0x'

// keccak256(toUtf8Bytes('Contract Proxy Kit'))
export const predeterminedSaltNonce =
  '0xcfe33a586323e7325be6aa6ecd8b4600d232a9037e83c8ece69413b777dabe65'
