import cpkFactoryAbi from '../abis/CpkFactoryAbi.json'
import multiSendAbi from '../abis/MultiSendAbi.json'
import safeAbiV111 from '../abis/SafeAbiV1-1-1.json'
import safeAbiV120 from '../abis/SafeAbiV1-2-0.json'
import { NormalizedNetworkConfigEntry } from '../config/networks'
import EthLibAdapter, { Contract } from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import ContractVersionUtils from './ContractVersionUtils'
import ContractV111Utils from './ContractV111Utils'
import ContractV120Utils from './ContractV120Utils'

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
  #proxyFactory?: Contract
  #masterCopyAddress: Address
  #multiSend: Contract
  #fallbackHandlerAddress: Address

  static async create(opts: ContractManagerProps): Promise<ContractManager> {
    const contractManager = new ContractManager(opts.ethLibAdapter, opts.network)
    await contractManager.init(opts)
    return contractManager
  }

  constructor(ethLibAdapter: EthLibAdapter, network: NormalizedNetworkConfigEntry) {
    this.#masterCopyAddress = network.masterCopyAddress
    this.#fallbackHandlerAddress = network.fallbackHandlerAddress
    this.#multiSend = ethLibAdapter.getContract(multiSendAbi, network.multiSendAddress)
  }

  async init(opts: ContractManagerProps): Promise<void> {
    await this.calculateVersionUtils(opts)
  }

  private async calculateVersionUtils(opts: ContractManagerProps) {
    const { ethLibAdapter, ownerAccount, saltNonce, network, isSafeApp, isConnectedToSafe } = opts
    let proxyAddress
    let properVersion
    let proxyFactory

    if (isSafeApp || isConnectedToSafe) {
      const temporaryContract = ethLibAdapter.getContract(safeAbiV111, ownerAccount)
      properVersion = await temporaryContract.call('VERSION', [])
      proxyAddress = ownerAccount
    } else {
      const salt = ethLibAdapter.keccak256(
        ethLibAdapter.abiEncode(['address', 'uint256'], [ownerAccount, saltNonce])
      )

      for (const { proxyFactoryAddress, initialImplAddress } of network.proxySearchParams) {
        proxyFactory = ethLibAdapter.getContract(cpkFactoryAbi, proxyFactoryAddress)
        proxyAddress = await this.calculateProxyAddress(
          proxyFactory,
          initialImplAddress,
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
        const { proxyFactoryAddress, initialImplAddress } = network.proxySearchParams[0]
        properVersion = '1.2.0'
        proxyFactory = ethLibAdapter.getContract(cpkFactoryAbi, proxyFactoryAddress)
        proxyAddress = await this.calculateProxyAddress(
          proxyFactory,
          initialImplAddress,
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

    this.#proxyFactory = proxyFactory
  }

  private async calculateProxyAddress(
    proxyFactory: Contract,
    initialImplAddress: Address,
    salt: string,
    ethLibAdapter: EthLibAdapter
  ): Promise<Address> {
    let proxyFactoryVersion;

    try {
      proxyFactoryVersion = (await proxyFactory.call('version', [])).toString()
    } catch(e) {}

    const initCode = ethLibAdapter.abiEncodePacked(
      { type: 'bytes', value: await proxyFactory.call('proxyCreationCode', []) },
      {
        type: 'bytes',
        value: ethLibAdapter.abiEncode(['address'], [initialImplAddress])
      }
    )

    let proxyDeployer;
    if (proxyFactoryVersion == '2') {
      salt = ethLibAdapter.keccak256(
        ethLibAdapter.abiEncodePacked(
          {
            type: "bytes32",
            // hardcoded keccak256('') because Web3 returns null for that in v1
            value: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'
          },
          { type: "bytes32", value: salt },
        )
      );
      proxyDeployer = await proxyFactory.call('gnosisSafeProxyFactory', []);
    } else {
      proxyDeployer = proxyFactory.address
    }

    const proxyAddress = ethLibAdapter.calcCreate2Address(
      proxyDeployer,
      salt,
      initCode
    )
    return proxyAddress
  }

  get versionUtils(): ContractVersionUtils | undefined {
    return this.#versionUtils
  }

  get contract(): Contract | undefined {
    return this.#contract
  }

  get proxyFactory(): Contract | undefined {
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
