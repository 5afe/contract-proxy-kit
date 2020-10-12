import CPK, { CPKConfig } from './CPK'
import EthLibAdapter from './ethLibAdapters/EthLibAdapter'
import EthersAdapter, { EthersAdapterConfig } from './ethLibAdapters/EthersAdapter'
import Web3Adapter, { Web3AdapterConfig } from './ethLibAdapters/Web3Adapter'
import TransactionManager, {
  TransactionManagerConfig,
  TransactionManagerNames
} from './transactionManagers/TransactionManager'
import CpkTransactionManager from './transactionManagers/CpkTransactionManager'
import SafeRelayTransactionManager from './transactionManagers/SafeRelayTransactionManager'
import {
  Transaction,
  OperationType,
  ExecOptions,
  TransactionResult
} from './utils/transactions'
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
  TransactionManagerNames,
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
  Web3AdapterConfig,
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
