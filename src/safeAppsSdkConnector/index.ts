import initSdk, {
  RequestId,
  SafeInfo,
  SdkInstance,
  TxConfirmationEvent,
  TxRejectionEvent
} from '@gnosis.pm/safe-apps-sdk'
import { v4 as uuidv4 } from 'uuid'
import SafeAppsSdkTransactionManager from '../transactionManagers/SafeAppsSdkTransactionManager'
import { StandardSafeAppsTransaction, TransactionResult } from '../utils/transactions'

interface TxCallback {
  confirm: (txResult: TransactionResult) => void
  reject: (error: Error) => void
}

class SafeAppsSdkConnector {
  appsSdk: SdkInstance
  safeAppInfo?: SafeInfo
  safeAppsSdkTransactionManager?: SafeAppsSdkTransactionManager
  txCallbacks = new Map<RequestId, TxCallback>()

  constructor() {
    const onSafeInfo = (safeInfo: SafeInfo): void => {
      this.safeAppInfo = safeInfo
      if (!this.safeAppsSdkTransactionManager) {
        this.safeAppsSdkTransactionManager = new SafeAppsSdkTransactionManager()
      }
    }

    const onTransactionConfirmation = (txConfirmation: TxConfirmationEvent): void => {
      const callback = this.txCallbacks.get(txConfirmation.requestId)
      if (callback) {
        this.txCallbacks.delete(txConfirmation.requestId)
        callback.confirm({ safeTxHash: txConfirmation.safeTxHash })
      }
    }

    const onTransactionRejection = (txRejection: TxRejectionEvent) => {
      const callback = this.txCallbacks.get(txRejection.requestId)
      if (callback) {
        this.txCallbacks.delete(txRejection.requestId)
        callback.reject(new Error('Transaction rejected'))
      }
    }

    this.appsSdk = initSdk()
    this.appsSdk.addListeners({
      onSafeInfo,
      onTransactionConfirmation,
      onTransactionRejection
    })
  }

  isSafeApp(): boolean {
    return !!this.safeAppInfo
  }

  sendTransactions(transactions: StandardSafeAppsTransaction[]): Promise<TransactionResult> {
    const requestId = uuidv4()
    return new Promise<TransactionResult>((confirm, reject) => {
      if (!this.safeAppsSdkTransactionManager) {
        throw new Error('Safe Apps SDK transactionManager uninitialized')
      }
      this.txCallbacks.set(requestId, { confirm, reject })
      this.safeAppsSdkTransactionManager.execTransactions({
        appsSdk: this.appsSdk,
        transactions,
        requestId
      })
    })
  }
}

export default SafeAppsSdkConnector
