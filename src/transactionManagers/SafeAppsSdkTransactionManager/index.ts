import TransactionManager, {
  TransactionManagerConfig,
  ExecTransactionSafeAppsProps,
  TransactionManagerNames
} from '../TransactionManager'

class SafeAppsSdkTransactionManager implements TransactionManager {
  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.SafeAppsSdkTransactionManager,
      url: undefined
    }
  }

  async execTransactions({
    appsSdk,
    transactions,
    requestId
  }: ExecTransactionSafeAppsProps): Promise<void> {
    appsSdk.sendTransactions(transactions, requestId)
  }
}

export default SafeAppsSdkTransactionManager
