import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import { StandardTransaction, Transaction, TransactionResult } from '../utils/transactions'

export enum TransactionManagerNames {
  CpkTxManager = 'CpkTransactionManager',
  SafeTxRelayManager = 'SafeTransactionRelayManager',
  RocksideTxRelayManager = 'RocksideTransactionRelayManager'
}

export interface TransactionManagerConfig {
  name: string
  url?: string
  speed?: string
}

export interface CPKContracts {
  safeContract: Contract
  proxyFactory?: Contract
  masterCopyAddress: Address
  fallbackHandlerAddress: Address
}

export interface ExecTransactionProps {
  ownerAccount: Address
  safeExecTxParams: StandardTransaction
  transactions: Transaction[]
  contracts: CPKContracts
  ethLibAdapter: EthLibAdapter
  saltNonce: string,
  isDeployed: boolean
  isConnectedToSafe: boolean
  sendOptions: any
}

interface TransactionManager {
  config: TransactionManagerConfig

  execTransactions(options: ExecTransactionProps): Promise<TransactionResult>
}

export default TransactionManager
