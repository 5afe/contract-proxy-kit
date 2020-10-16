import { NetworkConfigEntry } from '../config/networks'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import cpkFactoryAbi from '../abis/CpkFactoryAbi.json'
import safeAbi from '../abis/SafeAbi.json'
import multiSendAbi from '../abis/MultiSendAbi.json'
import ContractV120Manager from './ContractV120Manager'
import CommonContractManager from './CommonContractManager'

export interface ContractManagerProps {
  ethLibAdapter: EthLibAdapter
  network: NetworkConfigEntry
  ownerAccount: Address | undefined
  saltNonce: string
  isSafeApp: boolean
  isConnectedToSafe: boolean
}

class ContractManager {
  contractVersionManager?: CommonContractManager
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
    const { ethLibAdapter, network, ownerAccount, saltNonce, isSafeApp, isConnectedToSafe } = opts
    if (isSafeApp || isConnectedToSafe) {
      this.#contract = ethLibAdapter.getContract(safeAbi, ownerAccount)
    } else {
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
    this.contractVersionManager = new ContractV120Manager(this.#contract)
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
