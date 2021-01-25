import initSdk, {
  RequestId,
  SafeInfo,
  SdkInstance,
  TxConfirmationEvent,
  TxRejectionEvent
} from '@gnosis.pm/safe-apps-sdk'
import { v4 as uuidv4 } from 'uuid'
import { SimpleTransactionResult, StandardTransaction } from '../utils/transactions'

interface TxCallback {
  confirm: (txResult: SimpleTransactionResult) => void
  reject: (error: Error) => void
}

class SafeAppsSdkConnector {
  appsSdk: SdkInstance
  safeAppInfo?: SafeInfo
  txCallbacks = new Map<RequestId, TxCallback>()

  constructor() {
    const onSafeInfo = (safeInfo: SafeInfo): void => {
      this.safeAppInfo = safeInfo
    }

    const onTransactionConfirmation = (txConfirmation: TxConfirmationEvent): void => {
      const callback = this.txCallbacks.get(txConfirmation.requestId)
      if (callback) {
        this.txCallbacks.delete(txConfirmation.requestId)
        callback.confirm({ safeTxHash: txConfirmation.safeTxHash })
      }
    }

    const onTransactionRejection = (txRejection: TxRejectionEvent): void => {
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

  sendTransactions(transactions: StandardTransaction[]): Promise<SimpleTransactionResult> {
    const requestId = uuidv4()
    return new Promise<SimpleTransactionResult>((confirm, reject) => {
      this.txCallbacks.set(requestId, { confirm, reject })
      this.appsSdk.sendTransactions(transactions, requestId)
    })
  }
}

export default SafeAppsSdkConnector
