import initSdk, {
  RequestId,
  SafeInfo,
  SdkInstance,
  TxConfirmationEvent
} from '@gnosis.pm/safe-apps-sdk'
import { v4 as uuidv4 } from 'uuid'
import SafeAppsSdkTransactionManager from '../transactionManagers/SafeAppsSdkTransactionManager'
import { SafeAppsSdkTransactionResult, StandardSafeAppsTransaction } from '../utils/transactions'

class SafeAppsSdkConnector {
  appsSdk: SdkInstance
  safeAppInfo?: SafeInfo
  safeAppsSdkTransactionManager?: SafeAppsSdkTransactionManager
  txCallbacks = new Map<RequestId, (safeAppsSdkTxResult: SafeAppsSdkTransactionResult) => void>()

  private setSafeInfo(safeInfo: SafeInfo): void {
    this.safeAppInfo = safeInfo
    if (!this.safeAppsSdkTransactionManager) {
      this.safeAppsSdkTransactionManager = new SafeAppsSdkTransactionManager()
    }
  }

  private setTransactionConfirmation(txConfirmation: TxConfirmationEvent): void {
    const callback = this.txCallbacks.get(txConfirmation.requestId)
    if (callback) {
      this.txCallbacks.delete(txConfirmation.requestId)
      callback({ safeTxHash: txConfirmation.safeTxHash })
    }
  }

  constructor() {
    this.appsSdk = initSdk()
    this.appsSdk.addListeners({
      onSafeInfo: this.setSafeInfo,
      onTransactionConfirmation: this.setTransactionConfirmation
    })
  }

  isSafeApp(): boolean {
    return !!this.safeAppInfo
  }

  sendTransactions(
    transactions: StandardSafeAppsTransaction[]
  ): Promise<SafeAppsSdkTransactionResult> {
    const txCallback = new Promise<SafeAppsSdkTransactionResult>((returnFunction) => {
      if (!this.safeAppsSdkTransactionManager) {
        throw new Error('Safe Apps SDK transactionManager uninitialized')
      }
      const requestId = uuidv4()
      this.txCallbacks.set(requestId, returnFunction)
      this.safeAppsSdkTransactionManager.execTransactions({
        appsSdk: this.appsSdk,
        transactions,
        requestId
      })
    })
    return txCallback
  }
}

export default SafeAppsSdkConnector
