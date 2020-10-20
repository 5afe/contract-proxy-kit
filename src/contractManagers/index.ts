import { masterCopyAddressVersions, NetworkConfigEntry } from '../config/networks'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json'
import safeAbiV111 from '../abis/SafeAbiV1-1-1.json'
import safeAbiV120 from '../abis/SafeAbiV1-2-0.json'
import multiSendAbi from '../abis/MultiSendAbi.json'
import CommonContractManager from './CommonContractManager'
import ContractV120Manager from './ContractV120Manager'
import ContractV111Manager from './ContractV111Manager'
import { Address } from '../utils/basicTypes'

export interface ContractManagerProps {
  ethLibAdapter: EthLibAdapter
  network: NetworkConfigEntry
  ownerAccount: Address | undefined
  saltNonce: string
  isSafeApp: boolean
  isConnectedToSafe: boolean
}

class ContractManager {
  #contractVersionManager?: CommonContractManager
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

  constructor(ethLibAdapter: EthLibAdapter, network: NetworkConfigEntry) {
    this.#masterCopyAddress = network.masterCopyAddress
    this.#fallbackHandlerAddress = network.fallbackHandlerAddress
    this.#multiSend = ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress)
    this.#proxyFactory = ethLibAdapter.getContract(cpkFactoryAbi, network.proxyFactoryAddress)
  }

  async init(opts: ContractManagerProps): Promise<void> {
    await this.calculateContractVersionManager(opts)
  }

  private async calculateContractVersionManager(opts: ContractManagerProps) {
    const { ethLibAdapter, ownerAccount, saltNonce, isSafeApp, isConnectedToSafe } = opts
    let proxyAddress
    let properVersion

    const salt = ethLibAdapter.keccak256(
      ethLibAdapter.abiEncode(['address', 'uint256'], [ownerAccount, saltNonce])
    )

    if (isSafeApp || isConnectedToSafe) {
      const temporaryContract = ethLibAdapter.getContract(safeAbiV120, ownerAccount)
      const version: string = await temporaryContract.call('version', [])
      properVersion = version
    } else {
      for (const masterCopyVersion of masterCopyAddressVersions) {
        proxyAddress = await this.calculateProxyAddress(
          masterCopyVersion.address,
          salt,
          ethLibAdapter
        )

        const codeAtAddress = await ethLibAdapter.getCode(proxyAddress)
        const isDeployed = codeAtAddress !== '0x'
        if (isDeployed) {
          properVersion = masterCopyVersion.version
          break
        }
      }
    }

    if (!properVersion) {
      // Last version released
      properVersion = masterCopyAddressVersions[0].version
      proxyAddress = await this.calculateProxyAddress(
        masterCopyAddressVersions[0].address,
        salt,
        ethLibAdapter
      )
    }

    switch (properVersion) {
      case '1.2.0':
        this.#contract = ethLibAdapter.getContract(safeAbiV120, proxyAddress)
        this.#contractVersionManager = new ContractV120Manager(this.#contract)
        break
      case '1.1.1':
        this.#contract = ethLibAdapter.getContract(safeAbiV111, proxyAddress)
        this.#contractVersionManager = new ContractV111Manager(this.#contract)
        break
      default:
        throw new Error('CPK Proxy address version is not valid')
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

  get contractVersionManager(): CommonContractManager | undefined {
    return this.#contractVersionManager
  }

  get contract(): Contract | undefined {
    return this.#contract
  }

  get proxyFactory(): Contract {
    return this.#proxyFactory
  }

  get masterCopyAddress(): Address {
    return this.#masterCopyAddress
  }

  get multiSend(): Contract {
    return this.#multiSend
  }

  get fallbackHandlerAddress(): Address {
    return this.#fallbackHandlerAddress
  }
}

export default ContractManager
