import SafeAppsSDK, { SafeInfo, TxServiceModel } from '@gnosis.pm/safe-apps-sdk'
import { SimpleTransactionResult, StandardSafeAppsTransaction } from '../utils/transactions'

interface SafeTransactionParams {
  safeTxGas?: number
}

interface TxCallback {
  confirm: (txResult: SimpleTransactionResult) => void
  reject: (error: Error) => void
}

class SafeAppsSdkConnector {
  #appsSdk: SafeAppsSDK
  #isSafeApp = false

  constructor() {
    this.#appsSdk = new SafeAppsSDK()
    this.#appsSdk.getSafeInfo().then((appInfo) => {
      this.#isSafeApp = !!appInfo.safeAddress
    })
  }

  get isSafeApp(): boolean {
    return this.#isSafeApp
  }

  get appsSdk() {
    return this.#appsSdk
  }

  getSafeInfo(): Promise<SafeInfo> {
    return this.#appsSdk.getSafeInfo()
  }

  getBySafeTxHash(safeTxHash: string): Promise<TxServiceModel> {
    return this.#appsSdk.txs.getBySafeTxHash(safeTxHash)
  }

  sendTransactions(
    transactions: StandardSafeAppsTransaction[],
    params: SafeTransactionParams
  ): Promise<SimpleTransactionResult> {
    return this.#appsSdk.txs.send({ txs: transactions, params })
  }
}

export default SafeAppsSdkConnector
