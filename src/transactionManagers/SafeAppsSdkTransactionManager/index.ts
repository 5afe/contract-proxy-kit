import TransactionManager, { TransactionManagerConfig, ExecTransactionSafeAppsProps } from '../TransactionManager';
import { TransactionResult } from '../../utils/transactions';

class SafeAppsSdkTransactionManager implements TransactionManager  {

  get config(): TransactionManagerConfig {
    return {
      name: 'SafeAppsSdkTransactionManager',
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
