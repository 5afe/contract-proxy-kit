import ContractManager from '../contractManager'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import { StandardTransaction, Transaction, TransactionResult } from '../utils/transactions'

export enum TransactionManagerNames {
  CpkTransactionManager = 'CpkTransactionManager',
  SafeRelayTransactionManager = 'SafeRelayTransactionManager'
}

export interface TransactionManagerConfig {
  name: string
  url?: string
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
  transactions: Transaction[]
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
