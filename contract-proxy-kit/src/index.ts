import { TxServiceModel } from '@gnosis.pm/safe-apps-sdk'
import { defaultNetworks, NetworksConfig } from './config/networks'
import CPK, { CPKConfig } from './CPK'
import EthersAdapter, { EthersAdapterConfig } from './ethLibAdapters/EthersAdapter'
import EthLibAdapter from './ethLibAdapters/EthLibAdapter'
import Web3Adapter, { Web3AdapterConfig } from './ethLibAdapters/Web3Adapter'
import CpkTransactionManager from './transactionManagers/CpkTransactionManager'
import RocksideTxRelayManager, { RocksideSpeed } from './transactionManagers/RocksideTxRelayManager'
import SafeTxRelayManager from './transactionManagers/SafeTxRelayManager'
import TransactionManager, {
  TransactionManagerConfig,
  TransactionManagerNames
} from './transactionManagers/TransactionManager'
import { ExecOptions, OperationType, Transaction, TransactionResult } from './utils/transactions'

export default CPK

export {
  EthLibAdapter,
  EthersAdapter,
  Web3Adapter,
  // TransactionManagers
  CpkTransactionManager,
  SafeTxRelayManager,
  RocksideTxRelayManager,
  RocksideSpeed,
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
  TxServiceModel,
  // Configuration
  NetworksConfig
}

