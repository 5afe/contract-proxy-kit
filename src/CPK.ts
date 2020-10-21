import multiSendAbi from './abis/MultiSendAbi.json'
import {
  defaultNetworks,
  NetworksConfig,
  NormalizedNetworksConfig,
  normalizeNetworksConfig
} from './config/networks'
import ContractManager from './contractManagers'
import EthLibAdapter, { Contract } from './ethLibAdapters/EthLibAdapter'
import SafeAppsSdkConnector from './safeAppsSdkConnector'
import CpkTransactionManager from './transactionManagers/CpkTransactionManager'
import TransactionManager from './transactionManagers/TransactionManager'
import { Address } from './utils/basicTypes'
import { predeterminedSaltNonce } from './utils/constants'
import { getHexDataLength, joinHexData } from './utils/hexData'
import {
  ExecOptions,
  normalizeGasLimit,
  OperationType,
  standardizeSafeAppsTransaction,
  standardizeTransaction,
  StandardTransaction,
  Transaction,
  TransactionResult
} from './utils/transactions'
import { checkConnectedToSafe } from './utils/checkConnectedToSafe'

export interface CPKConfig {
  ethLibAdapter: EthLibAdapter
  transactionManager?: TransactionManager
  ownerAccount?: string
  networks?: NetworksConfig
  saltNonce?: string
}

class CPK {
  static Call = OperationType.Call
  static DelegateCall = OperationType.DelegateCall

  #safeAppsSdkConnector: SafeAppsSdkConnector
  #ethLibAdapter?: EthLibAdapter
  #transactionManager?: TransactionManager
  #contractManager?: ContractManager

  #networks: NormalizedNetworksConfig
  #ownerAccount?: Address
  #saltNonce = predeterminedSaltNonce
  #isConnectedToSafe = false

  static async create(opts?: CPKConfig): Promise<CPK> {
    const cpk = new CPK(opts)
    if (opts) {
      await cpk.init()
    }
    return cpk
  }

  constructor(opts?: CPKConfig) {
    this.#safeAppsSdkConnector = new SafeAppsSdkConnector()
    this.#networks = {
      ...defaultNetworks
    }
    if (!opts) {
      return
    }
    const { ethLibAdapter, transactionManager, ownerAccount, networks, saltNonce } = opts
    if (!ethLibAdapter) {
      throw new Error('ethLibAdapter property missing from options')
    }
    this.#ethLibAdapter = ethLibAdapter
    this.#transactionManager = transactionManager ?? new CpkTransactionManager()
    this.#ownerAccount = ownerAccount
    this.#networks = normalizeNetworksConfig(defaultNetworks, networks)
    if (saltNonce) {
      this.#saltNonce = saltNonce
    }
  }

  async init(): Promise<void> {
    if (!this.#ethLibAdapter) {
      throw new Error('CPK uninitialized ethLibAdapter')
    }

    const networkId = await this.#ethLibAdapter.getNetworkId()
    const network = this.#networks[networkId]
    if (!network) {
      throw new Error(`unrecognized network ID ${networkId}`)
    }

    const ownerAccount = await this.getOwnerAccount()

    this.#isConnectedToSafe = await checkConnectedToSafe(this.#ethLibAdapter.getProvider())

    this.#contractManager = await ContractManager.create({
      ethLibAdapter: this.#ethLibAdapter,
      network,
      ownerAccount,
      saltNonce: this.#saltNonce,
      isSafeApp: this.isSafeApp(),
      isConnectedToSafe: this.#isConnectedToSafe
    })
  }

  async isProxyDeployed(): Promise<boolean> {
    if (!this.address) {
      throw new Error('CPK address uninitialized')
    }
    if (!this.ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }
    const codeAtAddress = await this.ethLibAdapter.getCode(this.address)
    const isDeployed = codeAtAddress !== '0x'
    return isDeployed
  }

  isSafeApp(): boolean {
    return this.#safeAppsSdkConnector.isSafeApp()
  }

  async getOwnerAccount(): Promise<Address | undefined> {
    if (this.isSafeApp()) {
      return this.#safeAppsSdkConnector.safeAppInfo?.safeAddress
    }
    if (this.#ownerAccount) {
      return this.#ownerAccount
    }
    if (!this.#ethLibAdapter) {
      throw new Error('CPK uninitialized ethLibAdapter')
    }
    return this.#ethLibAdapter?.getAccount()
  }

  get ethLibAdapter(): EthLibAdapter | undefined {
    return this.#ethLibAdapter
  }

  get networks(): NormalizedNetworksConfig {
    return this.#networks
  }

  get isConnectedToSafe(): boolean {
    return this.#isConnectedToSafe
  }

  get contract(): Contract | undefined {
    return this.#contractManager?.contract
  }

  get multiSend(): Contract | undefined {
    return this.#contractManager?.multiSend
  }

  get proxyFactory(): Contract | undefined {
    return this.#contractManager?.proxyFactory
  }

  get masterCopyAddress(): Address | undefined {
    return this.#contractManager?.masterCopyAddress
  }

  get fallbackHandlerAddress(): Address | undefined {
    return this.#contractManager?.fallbackHandlerAddress
  }

  get saltNonce(): string {
    return this.#saltNonce
  }

  get address(): Address | undefined {
    if (this.isSafeApp()) {
      return this.#safeAppsSdkConnector.safeAppInfo?.safeAddress
    }
    return this.#contractManager?.contract?.address
  }

  setEthLibAdapter(ethLibAdapter: EthLibAdapter): void {
    this.#ethLibAdapter = ethLibAdapter
  }

  setTransactionManager(transactionManager: TransactionManager): void {
    if (this.isSafeApp()) {
      throw new Error('TransactionManagers are not allowed when the app is running as a Safe App')
    }
    this.#transactionManager = transactionManager
  }

  setNetworks(networks: NetworksConfig): void {
    this.#networks = normalizeNetworksConfig(defaultNetworks, networks)
  }

  encodeMultiSendCallData(transactions: Transaction[]): string {
    if (!this.#ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }

    const multiSend =
      this.#contractManager?.multiSend || this.#ethLibAdapter.getContract(multiSendAbi)
    const standardizedTxs = transactions.map(standardizeTransaction)

    const ethLibAdapter = this.#ethLibAdapter
    return multiSend.encode('multiSend', [
      joinHexData(
        standardizedTxs.map((tx) =>
          ethLibAdapter.abiEncodePacked(
            { type: 'uint8', value: tx.operation },
            { type: 'address', value: tx.to },
            { type: 'uint256', value: tx.value },
            { type: 'uint256', value: getHexDataLength(tx.data) },
            { type: 'bytes', value: tx.data }
          )
        )
      )
    ])
  }

  async execTransactions(
    transactions: Transaction[],
    options?: ExecOptions
  ): Promise<TransactionResult> {
    if (this.isSafeApp() && transactions.length >= 1) {
      const standardizedTxs = transactions.map(standardizeSafeAppsTransaction)
      return this.#safeAppsSdkConnector.sendTransactions(standardizedTxs)
    }

    if (!this.address) {
      throw new Error('CPK address uninitialized')
    }
    if (!this.#contractManager) {
      throw new Error('CPK contractManager uninitialized')
    }
    if (!this.#ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }
    if (!this.#transactionManager) {
      throw new Error('CPK transactionManager uninitialized')
    }

    const ownerAccount = await this.getOwnerAccount()
    if (!ownerAccount) {
      throw new Error('CPK ownerAccount uninitialized')
    }

    const safeExecTxParams = this.getSafeExecTxParams(transactions)
    const sendOptions = normalizeGasLimit({ ...options, from: ownerAccount })

    const codeAtAddress = await this.#ethLibAdapter.getCode(this.address)
    const isDeployed = codeAtAddress !== '0x'
    const txManager = !isDeployed ? new CpkTransactionManager() : this.#transactionManager

    return txManager.execTransactions({
      ownerAccount,
      safeExecTxParams,
      transactions,
      ethLibAdapter: this.#ethLibAdapter,
      contractManager: this.#contractManager,
      saltNonce: this.#saltNonce,
      isDeployed,
      isConnectedToSafe: this.#isConnectedToSafe,
      sendOptions
    })
  }

  async getModules(): Promise<Address[]> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.contractVersionManager) {
      throw new Error('CPK contractManager uninitialized')
    }
    return await this.#contractManager.contractVersionManager.getModules()
  }

  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.contractVersionManager) {
      throw new Error('CPK contractManager uninitialized')
    }
    return await this.#contractManager.contractVersionManager.isModuleEnabled(moduleAddress)
  }

  async enableModule(moduleAddress: Address): Promise<TransactionResult> {
    if (!this.#contractManager?.contractVersionManager) {
      throw new Error('CPK contractManager uninitialized')
    }
    if (!this.address) {
      throw new Error('CPK address uninitialized')
    }
    return await this.execTransactions([
      {
        to: this.address,
        data: await this.#contractManager.contractVersionManager.encodeEnableModule(moduleAddress),
        operation: CPK.Call
      }
    ])
  }

  async disableModule(moduleAddress: Address): Promise<TransactionResult> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.contractVersionManager) {
      throw new Error('CPK contractManager uninitialized')
    }
    if (!this.address) {
      throw new Error('CPK address uninitialized')
    }
    return await this.execTransactions([
      {
        to: this.address,
        data: await this.#contractManager.contractVersionManager.encodeDisableModule(moduleAddress),
        operation: CPK.Call
      }
    ])
  }

  private getSafeExecTxParams(transactions: Transaction[]): StandardTransaction {
    if (transactions.length === 1) {
      return standardizeTransaction(transactions[0])
    }

    if (!this.#contractManager?.multiSend) {
      throw new Error('CPK MultiSend uninitialized')
    }

    return {
      to: this.#contractManager?.multiSend.address,
      value: 0,
      data: this.encodeMultiSendCallData(transactions),
      operation: CPK.DelegateCall
    }
  }
}

export default CPK
