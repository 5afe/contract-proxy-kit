import cpkFactoryAbi from '../abis/CpkFactoryAbi.json'
import multiSendAbi from '../abis/MultiSendAbi.json'
import safeAbiV111 from '../abis/SafeAbiV1-1-1.json'
import safeAbiV120 from '../abis/SafeAbiV1-2-0.json'
import { NormalizedNetworkConfigEntry } from '../config/networks'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import ContractV111Utils from './ContractV111Utils'
import ContractV120Utils from './ContractV120Utils'
import ContractVersionUtils from './ContractVersionUtils'

export interface ContractManagerProps {
  ethLibAdapter: EthLibAdapter
  network: NormalizedNetworkConfigEntry
  ownerAccount: Address | undefined
  saltNonce: string
  isSafeApp: boolean
  isConnectedToSafe: boolean
}

class ContractManager {
  #versionUtils?: ContractVersionUtils
  #contract?: Contract
  #proxyFactory: Contract
  #masterCopyAddress: Address
  #multiSend: Contract
  #fallbackHandlerAddress: Address

  static async create(opts: ContractManagerProps): Promise<ContractManager> {
    const contractManager = new ContractManager(opts.ethLibAdapter, opts.network)
    await contractManager.init(opts)
    return contractManager
  }

  constructor(ethLibAdapter: EthLibAdapter, network: NormalizedNetworkConfigEntry) {
    this.#masterCopyAddress = network.masterCopyAddressVersions[0].address
    this.#fallbackHandlerAddress = network.fallbackHandlerAddress
    this.#multiSend = ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress)
    this.#proxyFactory = ethLibAdapter.getContract(cpkFactoryAbi, network.proxyFactoryAddress)
  }

  async init(opts: ContractManagerProps): Promise<void> {
    await this.calculateVersionUtils(opts)
  }

  private async calculateVersionUtils(opts: ContractManagerProps) {
    const { ethLibAdapter, ownerAccount, saltNonce, network, isSafeApp, isConnectedToSafe } = opts
    let proxyAddress
    let properVersion

    if (isSafeApp || isConnectedToSafe) {
      const temporaryContract = ethLibAdapter.getContract(safeAbiV111, ownerAccount)
      properVersion = await temporaryContract.call('VERSION', [])
      proxyAddress = ownerAccount
    } else {
      const salt = ethLibAdapter.keccak256(
        ethLibAdapter.abiEncode(['address', 'uint256'], [ownerAccount, saltNonce])
      )

      for (const masterCopyVersion of network.masterCopyAddressVersions) {
        proxyAddress = await this.calculateProxyAddress(
          masterCopyVersion.address,
          salt,
          ethLibAdapter
        )

        const codeAtAddress = await ethLibAdapter.getCode(proxyAddress)
        const isDeployed = codeAtAddress !== '0x'
        if (isDeployed) {
          const temporaryContract = ethLibAdapter.getContract(safeAbiV111, proxyAddress)
          properVersion = await temporaryContract.call('VERSION', [])
          break
        }
      }

      if (!properVersion) {
        // Last version released
        properVersion = network.masterCopyAddressVersions[0].version
        proxyAddress = await this.calculateProxyAddress(
          network.masterCopyAddressVersions[0].address,
          salt,
          ethLibAdapter
        )
      }
    }

    switch (properVersion) {
      case '1.2.0':
        this.#contract = ethLibAdapter.getContract(safeAbiV120, proxyAddress)
        this.#versionUtils = new ContractV120Utils(this.#contract)
        break
      case '1.1.1':
        this.#contract = ethLibAdapter.getContract(safeAbiV111, proxyAddress)
        this.#versionUtils = new ContractV111Utils(this.#contract)
        break
      default:
        throw new Error('CPK Proxy version is not valid')
    }
  }

  private async calculateProxyAddress(
    masterCopyAddress: Address,
    salt: string,
    ethLibAdapter: EthLibAdapter
  ): Promise<Address> {
    const initCode = ethLibAdapter.abiEncodePacked(
      { type: 'bytes', value: await this.#proxyFactory.call('proxyCreationCode', []) },
      {
        type: 'bytes',
        value: ethLibAdapter.abiEncode(['address'], [masterCopyAddress])
      }
    )
    const proxyAddress = ethLibAdapter.calcCreate2Address(
      this.#proxyFactory.address,
      salt,
      initCode
    )
    return proxyAddress
  }

  get versionUtils(): ContractVersionUtils | undefined {
    return this.#versionUtils
  }

  /**
   * Returns the instance of the Safe contract in use.
   *
   * @returns The instance of the Safe contract in use
   */
  get contract(): Contract | undefined {
    return this.#contract
  }

  /**
   * Returns the instance of the Proxy Factory contract in use.
   *
   * @returns The instance of the Proxy Factory contract in use
   */
  get proxyFactory(): Contract {
    return this.#proxyFactory
  }

  /**
   * Returns the Master Copy contract address in use.
   *
   * @returns The Master Copy contract address in use
   */
  get masterCopyAddress(): Address {
    return this.#masterCopyAddress
  }

  /**
   * Returns the instance of the MultiSend contract in use.
   *
   * @returns The instance of the MultiSend contract in use
   */
  get multiSend(): Contract {
    return this.#multiSend
  }

  /**
   * Returns the FallbackHandler contract address in use.
   *
   * @returns The FallbackHandler contract address in use
   */
  get fallbackHandlerAddress(): Address {
    return this.#fallbackHandlerAddress
  }
}

export default ContractManager
