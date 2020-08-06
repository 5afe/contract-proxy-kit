import CPK, { CPKConfig } from './CPK'
import EthLibAdapter from './ethLibAdapters/EthLibAdapter'
import EthersAdapter, {
  EthersAdapterConfig,
  EthersTransactionResult
} from './ethLibAdapters/EthersAdapter'
import Web3Adapter, { Web3AdapterConfig, Web3TransactionResult } from './ethLibAdapters/Web3Adapter'
import TransactionManager, {
  TransactionManagerConfig
} from './transactionManagers/TransactionManager'
import CpkTransactionManager from './transactionManagers/CpkTransactionManager'
import SafeRelayTransactionManager from './transactionManagers/SafeRelayTransactionManager'
import SafeAppsSdkTransactionManager from './transactionManagers/SafeAppsSdkTransactionManager'
import { Transaction, OperationType, ExecOptions, TransactionResult } from './utils/transactions'
import { defaultNetworks, NetworksConfig } from './config/networks'

export default CPK

export {
  // EthLibAdapters
  EthLibAdapter,
  EthersAdapter,
  Web3Adapter,
  // TransactionManagers
  CpkTransactionManager,
  SafeRelayTransactionManager,
  SafeAppsSdkTransactionManager,
  // Transactions
  OperationType,
  // Configuration
  defaultNetworks
}

export type {
  // CPK
  CPKConfig,
  // EthLibAdapters
  EthersAdapterConfig,
  EthersTransactionResult,
  Web3AdapterConfig,
  Web3TransactionResult,
  // TransactionManagers
  TransactionManager,
  TransactionManagerConfig,
  // Transactions
  Transaction,
  ExecOptions,
  TransactionResult,
  // Configuration
  NetworksConfig
}
