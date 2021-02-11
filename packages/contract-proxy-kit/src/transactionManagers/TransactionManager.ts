import ContractManager from '../contractManager'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import { StandardTransaction, TransactionResult } from '../utils/transactions'

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
  proxyFactory: Contract
  masterCopyAddress: Address
  fallbackHandlerAddress: Address
}

export interface ExecTransactionProps {
  ownerAccount: Address
  safeExecTxParams: StandardTransaction
  transactions: StandardTransaction[]
  contractManager: ContractManager
  ethLibAdapter: EthLibAdapter
  saltNonce: string
  isDeployed: boolean
  isConnectedToSafe: boolean
  sendOptions: any
}

interface TransactionManager {
  config: TransactionManagerConfig

  /**
   * Executes a list of transactions.
   *
   * @param options
   * @returns The transaction response
   */
  execTransactions(options: ExecTransactionProps): Promise<TransactionResult>
}

export default TransactionManager
