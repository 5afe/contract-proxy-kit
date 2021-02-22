import SafeAppsSDK, { SafeInfo, TxServiceModel } from '@gnosis.pm/safe-apps-sdk'
import { Address } from '../utils/basicTypes'
import { SimpleTransactionResult, StandardTransaction } from '../utils/transactions'

interface SafeTransactionParams {
  safeTxGas?: number
}

class SafeAppsSdkConnector {
  #appsSdk: SafeAppsSDK
  #safeAddress?: Address
  #isSafeApp = false

  constructor() {
    this.#appsSdk = new SafeAppsSDK()
    this.#appsSdk.getSafeInfo().then((appInfo: SafeInfo) => {
      this.#isSafeApp = !!appInfo.safeAddress
      this.#safeAddress = appInfo.safeAddress
    })
  }

  /**
   * Checks if the CPK is running as a Safe App or as a standalone app.
   *
   * @returns TRUE if the CPK is running as a Safe App
   */
  get isSafeApp(): boolean {
    return this.#isSafeApp
  }

  /**
   * Returns the Safe address connected to the CPK if the CPK is running as a Safe App.
   *
   * @returns The Safe address
   */
  get safeAddress(): Address | undefined {
    return this.#safeAddress
  }

  /**
   * Returns an instance of the Safe Apps SDK used by the CPK.
   *
   * @returns The Safe Apps SDK instance
   */
  get appsSdk() {
    return this.#appsSdk
  }

  /**
   * Returns the information of the connected Safe App.
   *
   * @returns The information of the connected Safe App
   */
  getSafeInfo(): Promise<SafeInfo> {
    return this.#appsSdk.getSafeInfo()
  }

  /**
   * Returns the transaction response for the given Safe transaction hash.
   *
   * @param safeTxHash - The desired Safe transaction hash
   * @returns The transaction response for the Safe transaction hash
   */
  getBySafeTxHash(safeTxHash: string): Promise<TxServiceModel> {
    return this.#appsSdk.txs.getBySafeTxHash(safeTxHash)
  }

  sendTransactions(
    transactions: StandardTransaction[],
    params: SafeTransactionParams
  ): Promise<SimpleTransactionResult> {
    return this.#appsSdk.txs.send({ txs: transactions, params })
  }
}

export default SafeAppsSdkConnector
