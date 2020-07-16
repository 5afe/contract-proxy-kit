import TransactionManager, { TransactionManagerConfig, ExecTransactionSafeAppsProps, TransactionManagerNames } from '../TransactionManager';
import { TransactionResult } from '../../utils/transactions';

class SafeAppsSdkTransactionManager implements TransactionManager  {

  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.SafeAppsSdkTransactionManager,
      url: undefined,
    };
  }

  async execTransactions({
    appsSdk,
    transactions
  }: ExecTransactionSafeAppsProps): Promise<TransactionResult> {
    appsSdk.sendTransactions(transactions)
    
    return new Promise(
      (resolve, reject) => resolve({ hash: 'unknown' })
    )
  }
}

export default SafeAppsSdkTransactionManager;
