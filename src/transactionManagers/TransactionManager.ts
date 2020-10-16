import { TransactionResult, StandardTransaction, Transaction } from '../utils/transactions'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import ContractManager from '../contractManagers'
import { Address } from '../utils/basicTypes'

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

  execTransactions(options: ExecTransactionProps): Promise<TransactionResult>
}

export default TransactionManager
