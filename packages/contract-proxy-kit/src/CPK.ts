import BigNumber from 'bignumber.js'
import multiSendAbi from './abis/MultiSendAbi.json'
import {
  defaultNetworks,
  NetworksConfig,
  NormalizedNetworksConfig,
  normalizeNetworksConfig
} from './config/networks'
import ContractManager from './contractManager'
import EthLibAdapter from './ethLibAdapters/EthLibAdapter'
import SafeAppsSdkConnector from './safeAppsSdkConnector'
import CpkTransactionManager from './transactionManagers/CpkTransactionManager'
import TransactionManager from './transactionManagers/TransactionManager'
import { Address } from './utils/basicTypes'
import { checkConnectedToSafe } from './utils/checkConnectedToSafe'
import { predeterminedSaltNonce } from './utils/constants'
import { getHexDataLength, joinHexData } from './utils/hexData'
import { getNetworkIdFromName } from './utils/networks'
import {
  ExecOptions,
  normalizeGasLimit,
  OperationType,
  standardizeTransaction,
  StandardTransaction,
  Transaction,
  TransactionResult
} from './utils/transactions'

export interface CPKConfig {
  ethLibAdapter: EthLibAdapter
  transactionManager?: TransactionManager
  ownerAccount?: string
  networks?: NetworksConfig
  saltNonce?: string
  isSafeApp?: boolean
}

class CPK {
  static Call = OperationType.Call
  static DelegateCall = OperationType.DelegateCall

  #safeAppsSdkConnector?: SafeAppsSdkConnector
  #ethLibAdapter?: EthLibAdapter
  #transactionManager?: TransactionManager
  #contractManager?: ContractManager

  #networks: NormalizedNetworksConfig
  #ownerAccount?: Address
  #saltNonce = predeterminedSaltNonce
  #isConnectedToSafe = false

  /**
   * Creates and initializes an instance of the CPK with the selected configuration parameters.
   *
   * @param opts - CPK configuration
   * @returns The CPK instance
   */
  static async create(opts?: CPKConfig): Promise<CPK> {
    const cpk = new CPK(opts)
    if (opts) {
      await cpk.init()
    }
    return cpk
  }

  /**
   * Creates a non-initialized instance of the CPK with the selected configuration parameters.
   *
   * @param opts - CPK configuration
   * @returns The CPK instance
   */
  constructor(opts?: CPKConfig) {
    this.#networks = {
      ...defaultNetworks
    }
    if (!opts) {
      return
    }
    const {
      ethLibAdapter,
      transactionManager,
      ownerAccount,
      networks,
      saltNonce,
      isSafeApp = true
    } = opts
    if (isSafeApp) {
      this.#safeAppsSdkConnector = new SafeAppsSdkConnector()
    }
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

  /**
   * Initializes the CPK instance.
   */
  async init(): Promise<void> {
    if (!this.#ethLibAdapter) {
      throw new Error('CPK uninitialized ethLibAdapter')
    }

    const networkId = await this.#ethLibAdapter.getNetworkId()
    const network = this.#networks[networkId]
    if (!network) {
      throw new Error(`Unrecognized network ID ${networkId}`)
    }

    const ownerAccount = await this.getOwnerAccount()

    this.#isConnectedToSafe =
      (await checkConnectedToSafe(this.#ethLibAdapter.getProvider())) ||
      this.#safeAppsSdkConnector?.isSafeApp === true

    this.#contractManager = await ContractManager.create({
      ethLibAdapter: this.#ethLibAdapter,
      network,
      ownerAccount,
      saltNonce: this.#saltNonce,
      isSafeApp: this.#safeAppsSdkConnector?.isSafeApp === true,
      isConnectedToSafe: this.#isConnectedToSafe
    })
  }

  /**
   * Checks if the Proxy contract is deployed or not. The deployment of the Proxy contract happens automatically when the first transaction is submitted.
   *
   * @returns TRUE when the Proxy contract is deployed
   */
  async isProxyDeployed(): Promise<boolean> {
    const address = await this.address
    if (!address) {
      throw new Error('CPK address uninitialized')
    }
    if (!this.ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }
    const codeAtAddress = await this.ethLibAdapter.getCode(address)
    const isDeployed = codeAtAddress !== '0x'
    return isDeployed
  }

  /**
   * Returns the address of the account connected to the CPK (Proxy contract owner). However, if the CPK is running as a Safe App or connected to a Safe, the Safe address will be returned.
   *
   * @returns The address of the account connected to the CPK
   */
  async getOwnerAccount(): Promise<Address | undefined> {
    if (this.#safeAppsSdkConnector?.isSafeApp) {
      return (await this.#safeAppsSdkConnector.getSafeInfo()).safeAddress
    }
    if (this.#ownerAccount) {
      return this.#ownerAccount
    }
    if (!this.#ethLibAdapter) {
      throw new Error('CPK uninitialized ethLibAdapter')
    }
    return this.#ethLibAdapter?.getAccount()
  }

  /**
   * Returns the ETH balance of the Proxy contract.
   *
   * @returns The ETH balance of the Proxy contract
   */
  async getBalance(): Promise<BigNumber> {
    const address = await this.address
    if (!address) {
      throw new Error('CPK address uninitialized')
    }
    if (!this.#ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }
    return this.#ethLibAdapter?.getBalance(address)
  }

  /**
   * Returns the ID of the connected network.
   *
   * @returns The ID of the connected network
   */
  async getNetworkId(): Promise<number | undefined> {
    if (this.#safeAppsSdkConnector?.isSafeApp) {
      const networkName = (await this.#safeAppsSdkConnector.getSafeInfo()).network
      return getNetworkIdFromName(networkName)
    }
    if (!this.#ethLibAdapter) {
      throw new Error('CPK ethLibAdapter uninitialized')
    }
    return this.#ethLibAdapter.getNetworkId()
  }

  /**
   * Returns the safeAppsSdkConnector used by the CPK.
   *
   * @returns The safeAppsSdkConnector used by the CPK
   */
  get safeAppsSdkConnector(): SafeAppsSdkConnector | undefined {
    return this.#safeAppsSdkConnector
  }

  /**
   * Returns the contractManager used by the CPK.
   *
   * @returns The contractManager used by the CPK
   */
  get contractManager(): ContractManager | undefined {
    return this.#contractManager
  }

  /**
   * Returns the ethLibAdapter used by the CPK.
   *
   * @returns The ethLibAdapter used by the CPK
   */
  get ethLibAdapter(): EthLibAdapter | undefined {
    return this.#ethLibAdapter
  }

  /**
   * Returns a list of the contract addresses which drive the CPK per network by network ID.
   *
   * @returns The list of the contract addresses which drive the CPK per network by network ID
   */
  get networks(): NormalizedNetworksConfig {
    return this.#networks
  }

  /**
   * Checks if the CPK is connected to a Safe account or not.
   *
   * @returns TRUE if the CPK is connected to a Safe account
   */
  get isConnectedToSafe(): boolean {
    return this.#isConnectedToSafe
  }

  /**
   * Returns the salt nonce used to deploy the Proxy Contract.
   *
   * @returns The salt nonce used to deploy the Proxy Contract
   */
  get saltNonce(): string {
    return this.#saltNonce
  }

  /**
   * Returns the address of the Proxy contract.
   *
   * @returns The address of the Proxy contract
   */
  get address(): Address | undefined {
    if (this.#safeAppsSdkConnector?.safeAddress) {
      return this.#safeAppsSdkConnector?.safeAddress
    }
    return this.#contractManager?.contract?.address
  }

  /**
   * Sets the ethLibAdapter used by the CPK.
   */
  setEthLibAdapter(ethLibAdapter: EthLibAdapter): void {
    this.#ethLibAdapter = ethLibAdapter
  }

  /**
   * Sets the transactionManager used by the CPK.
   */
  setTransactionManager(transactionManager: TransactionManager): void {
    if (this.#safeAppsSdkConnector?.isSafeApp) {
      throw new Error('TransactionManagers are not allowed when the app is running as a Safe App')
    }
    this.#transactionManager = transactionManager
  }

  /**
   * Sets the network configuration used by the CPK.
   */
  setNetworks(networks: NetworksConfig): void {
    this.#networks = normalizeNetworksConfig(defaultNetworks, networks)
  }

  /**
   * Returns the encoding of a list of transactions.
   *
   * @param transactions - The transaction list
   * @returns The encoding of a list of transactions
   */
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

  /**
   * Executes a list of transactions.
   *
   * @param transactions - The transaction list to execute
   * @param options - Execution configuration options
   * @returns The transaction response
   */
  async execTransactions(
    transactions: Transaction[],
    options?: ExecOptions
  ): Promise<TransactionResult> {
    const standardizedTxs = transactions.map(standardizeTransaction)

    if (this.#safeAppsSdkConnector?.isSafeApp && transactions.length >= 1) {
      return this.#safeAppsSdkConnector.sendTransactions(standardizedTxs, {
        safeTxGas: options?.safeTxGas
      })
    }

    const address = await this.address
    if (!address) {
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

    const codeAtAddress = await this.#ethLibAdapter.getCode(address)
    const isDeployed = codeAtAddress !== '0x'
    const txManager = !isDeployed ? new CpkTransactionManager() : this.#transactionManager

    return txManager.execTransactions({
      ownerAccount,
      safeExecTxParams,
      transactions: standardizedTxs,
      ethLibAdapter: this.#ethLibAdapter,
      contractManager: this.#contractManager,
      saltNonce: this.#saltNonce,
      isDeployed,
      isConnectedToSafe: this.#isConnectedToSafe,
      sendOptions
    })
  }

  /**
   * Returns the Master Copy contract version.
   *
   * @returns The Master Copy contract version
   */
  async getContractVersion(): Promise<string> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.versionUtils) {
      throw new Error('CPK contractManager uninitialized')
    }
    return await this.#contractManager.versionUtils.getContractVersion()
  }

  /**
   * Returns the list of addresses of all the enabled Safe modules.
   *
   * @returns The list of addresses of all the enabled Safe modules
   */
  async getModules(): Promise<Address[]> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.versionUtils) {
      throw new Error('CPK contractManager uninitialized')
    }
    return await this.#contractManager.versionUtils.getModules()
  }

  /**
   * Checks if a specific Safe module is enabled or not.
   *
   * @param moduleAddress - The desired module address
   * @returns TRUE if the module is enabled
   */
  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.versionUtils) {
      throw new Error('CPK contractManager uninitialized')
    }
    return await this.#contractManager.versionUtils.isModuleEnabled(moduleAddress)
  }

  /**
   * Enables a Safe module
   *
   * @param moduleAddress - The desired module address
   * @returns The transaction response
   */
  async enableModule(moduleAddress: Address): Promise<TransactionResult> {
    if (!this.#contractManager?.versionUtils) {
      throw new Error('CPK contractManager uninitialized')
    }
    const address = await this.address
    if (!address) {
      throw new Error('CPK address uninitialized')
    }
    return await this.execTransactions([
      {
        to: address,
        data: await this.#contractManager.versionUtils.encodeEnableModule(moduleAddress),
        operation: CPK.Call
      }
    ])
  }

  /**
   * Disables a Safe module
   *
   * @param moduleAddress - The desired module address
   * @returns The transaction response
   */
  async disableModule(moduleAddress: Address): Promise<TransactionResult> {
    const isProxyDeployed = await this.isProxyDeployed()
    if (!isProxyDeployed) {
      throw new Error('CPK Proxy contract is not deployed')
    }
    if (!this.#contractManager?.versionUtils) {
      throw new Error('CPK contractManager uninitialized')
    }
    const address = await this.address
    if (!address) {
      throw new Error('CPK address uninitialized')
    }
    return await this.execTransactions([
      {
        to: address,
        data: await this.#contractManager.versionUtils.encodeDisableModule(moduleAddress),
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
      value: '0',
      data: this.encodeMultiSendCallData(transactions),
      operation: CPK.DelegateCall
    }
  }
}

export default CPK
