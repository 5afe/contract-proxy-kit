import { NetworkConfigEntry } from '../config/networks'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json'
import safeAbi from '../abis/SafeAbi.json'
import multiSendAbi from '../abis/MultiSendAbi.json'

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
  #proxyFactory?: Contract
  #masterCopyAddress?: Address
  #multiSend?: Contract
  #fallbackHandlerAddress?: Address

  async init(opts: ContractManagerProps): Promise<void> {
    const { ethLibAdapter, network, ownerAccount, saltNonce, isSafeApp, isConnectedToSafe } = opts

    this.#masterCopyAddress = network.masterCopyAddress
    this.#fallbackHandlerAddress = network.fallbackHandlerAddress
    this.#multiSend = ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress)
    this.#proxyFactory = ethLibAdapter.getContract(cpkFactoryAbi, network.proxyFactoryAddress)

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

  get proxyFactory(): Contract | undefined {
    return this.#proxyFactory
  }

  get masterCopyAddress(): Address | undefined {
    return this.#masterCopyAddress
  }

  get multiSend(): Contract | undefined {
    return this.#multiSend
  }

  get fallbackHandlerAddress(): Address | undefined {
    return this.#fallbackHandlerAddress
  }
}

export default ContractManager
