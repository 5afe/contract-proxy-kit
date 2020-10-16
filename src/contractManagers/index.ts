import { NetworkConfigEntry } from '../config/networks'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json'
import safeAbi from '../abis/SafeAbi.json'
import multiSendAbi from '../abis/MultiSendAbi.json'
import { sentinelModules } from '../utils/constants'

export interface ContractManagerProps {
  ethLibAdapter: EthLibAdapter
  network: NetworkConfigEntry
  ownerAccount: Address | undefined
  saltNonce: string
  isSafeApp: boolean
  isConnectedToSafe: boolean
}

abstract class ContractManager {
  #contract?: Contract
  #proxyFactory: Contract
  #masterCopyAddress: Address
  #multiSend: Contract
  #fallbackHandlerAddress: Address

  constructor(ethLibAdapter: EthLibAdapter, network: NetworkConfigEntry) {
    this.#masterCopyAddress = network.masterCopyAddress
    this.#fallbackHandlerAddress = network.fallbackHandlerAddress
    this.#multiSend = ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress)
    this.#proxyFactory = ethLibAdapter.getContract(cpkFactoryAbi, network.proxyFactoryAddress)
  }

  async init(opts: ContractManagerProps): Promise<void> {
    const { ethLibAdapter, network, ownerAccount, saltNonce, isSafeApp, isConnectedToSafe } = opts

    if (isSafeApp || isConnectedToSafe) {
      this.#contract = ethLibAdapter.getContract(safeAbi, ownerAccount)
      return
    }

    const salt = ethLibAdapter.keccak256(
      ethLibAdapter.abiEncode(['address', 'uint256'], [ownerAccount, saltNonce])
    )
    const initCode = ethLibAdapter.abiEncodePacked(
      { type: 'bytes', value: await this.#proxyFactory.call('proxyCreationCode', []) },
      {
        type: 'bytes',
        value: ethLibAdapter.abiEncode(['address'], [network.masterCopyAddress])
      }
    )
    const proxyAddress = ethLibAdapter.calcCreate2Address(
      this.#proxyFactory.address,
      salt,
      initCode
    )

    this.#contract = ethLibAdapter.getContract(safeAbi, proxyAddress)
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

  async getModules(): Promise<Address[]> {
    if (!this.contract) {
      throw new Error('CPK Proxy contract uninitialized')
    }
    return this.contract.call('getModules', [])
  }

  async isModuleEnabled(moduleAddress: Address): Promise<boolean> {
    if (!this.contract) {
      throw new Error('CPK Proxy contract uninitialized')
    }
    return this.contract.call('isModuleEnabled', [moduleAddress])
  }

  async encodeEnableModule(moduleAddress: Address): Promise<string> {
    if (!this.contract) {
      throw new Error('CPK Proxy contract uninitialized')
    }
    return this.contract.encode('enableModule', [moduleAddress])
  }

  async encodeDisableModule(moduleAddress: Address): Promise<string> {
    if (!this.contract) {
      throw new Error('CPK Proxy contract uninitialized')
    }
    const modules = await this.contract.call('getModules', [])
    const index = modules.findIndex(
      (module: Address) => module.toLowerCase() === moduleAddress.toLowerCase()
    )
    const prevModuleAddress = index === 0 ? sentinelModules : modules[index - 1]
    return this.contract.encode('disableModule', [prevModuleAddress, moduleAddress])
  }
}

export default ContractManager
