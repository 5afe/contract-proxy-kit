import BigNumber from 'bignumber.js'
import { Abi, Address } from '../../utils/basicTypes'
import { zeroAddress } from '../../utils/constants'
import {
  EthCallTx,
  EthersTransactionResult,
  EthSendTx,
  formatCallTx,
  normalizeGasLimit
} from '../../utils/transactions'
import EthLibAdapter, { Contract } from '../EthLibAdapter'
import EthersV4ContractAdapter from './EthersV4ContractAdapter'
import EthersV5ContractAdapter from './EthersV5ContractAdapter'

export interface EthersAdapterConfig {
  ethers: any
  signer: any
}

class EthersAdapter extends EthLibAdapter {
  ethers: any
  signer: any

  /**
   * Creates an instance of EthersAdapter
   *
   * @param options - EthersAdapter configuration
   * @returns The EthersAdapter instance
   */
  constructor({ ethers, signer }: EthersAdapterConfig) {
    super()

    if (!ethers) {
      throw new Error('ethers property missing from options')
    }
    if (!signer) {
      throw new Error('signer property missing from options')
    }
    this.ethers = ethers
    this.signer = signer
  }

  /**
   * Returns the current provider
   *
   * @returns The current provider
   */
  getProvider(): any {
    // eslint-disable-next-line no-underscore-dangle
    return this.signer.provider.provider || this.signer.provider._web3Provider
  }

  /**
   * Sends a network request via JSON-RPC.
   *
   * @param method - JSON-RPC method
   * @param params - Params
   * @returns The request response
   */
  providerSend(method: string, params: any[]): Promise<any> {
    return this.signer.provider.send(method, params)
  }

  /**
   * Signs data using a specific account.
   *
   * @param message - Data to sign
   * @param ownerAccount - Address to sign the data with
   * @returns The signature
   */
  signMessage(message: string): Promise<string> {
    const messageArray = this.ethers.utils.arrayify(message)
    return this.signer.signMessage(messageArray)
  }

  /**
   * Returns the current network ID.
   *
   * @returns The network ID
   */
  async getNetworkId(): Promise<number> {
    return (await this.signer.provider.getNetwork()).chainId
  }

  /**
   * Returns the default account used as the default "from" property.
   *
   * @returns The default account address
   */
  async getAccount(): Promise<Address> {
    return this.signer.getAddress()
  }

  /**
   * Returns the balance of an address.
   *
   * @param address - The desired address
   * @returns The balance of the address
   */
  async getBalance(address: Address): Promise<BigNumber> {
    return new BigNumber(await this.signer.provider.getBalance(address))
  }

  /**
   * Returns the keccak256 hash of the data.
   *
   * @param data - Desired data
   * @returns The keccak256 of the data
   */
  keccak256(data: string): string {
    return this.ethers.utils.keccak256(data)
  }

  /**
   * Encodes a function parameters based on its JSON interface object.
   *
   * @param types - An array with the types or a JSON interface of a function
   * @param values - The parameters to encode
   * @returns The ABI encoded parameters
   */
  abiEncode(types: string[], values: any[]): string {
    return this.ethers.utils.defaultAbiCoder.encode(types, values)
  }

  /**
   * Decodes ABI encoded parameters to is JavaScript types.
   *
   * @param types - An array with the types or a JSON interface outputs array
   * @param data - The ABI byte code to decode
   * @returns The ABI encoded parameters
   */
  abiDecode(types: string[], data: string): any[] {
    return this.ethers.utils.defaultAbiCoder.decode(types, data)
  }

  /**
   * Returns an instance of a contract.
   *
   * @param abi - ABI of the desired contract
   * @param address - Contract address
   * @returns The contract instance
   */
  getContract(abi: Abi, address?: Address): Contract {
    const contract = new this.ethers.Contract(address || zeroAddress, abi, this.signer)
    const ethersVersion = this.ethers.version

    // TO-DO: Use semver comparison
    if (ethersVersion.split('.')[0] === '4') {
      return new EthersV4ContractAdapter(contract, this)
    }
    if (ethersVersion.split('.')[0] === 'ethers/5') {
      return new EthersV5ContractAdapter(contract, this)
    }
    throw new Error(`ethers version ${ethersVersion} not supported`)
  }

  /**
   * Deterministically returns the address where a contract will be deployed.
   *
   * @param deployer - Account that deploys the contract
   * @param salt - Salt
   * @param initCode - Code to be deployed
   * @returns The address where the contract will be deployed
   */
  calcCreate2Address(deployer: Address, salt: string, initCode: string): string {
    return this.ethers.utils.getAddress(
      this.ethers.utils
        .solidityKeccak256(
          ['bytes', 'address', 'bytes32', 'bytes32'],
          ['0xff', deployer, salt, this.keccak256(initCode)]
        )
        .slice(-40)
    )
  }

  /**
   * Returns the code at a specific address.
   *
   * @param address - The desired address
   * @returns The code of the contract
   */
  getCode(address: Address): Promise<string> {
    return this.signer.provider.getCode(address)
  }

  /**
   * Returns a block matching the block number or block hash.
   *
   * @param blockHashOrBlockNumber - The block number or block hash
   * @returns The block object
   */
  getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }> {
    return this.signer.provider.getBlock(blockHashOrBlockNumber)
  }

  /**
   * Returns the revert reason when a call fails.
   *
   * @param tx - Transaction to execute
   * @param block - Block number
   * @returns The revert data when the call fails
   */
  async getCallRevertData(tx: EthCallTx, block: string | number): Promise<string> {
    try {
      // Handle old Geth/Ganache --noVMErrorsOnRPCResponse revert data
      return await this.ethCall(tx, block)
    } catch (e) {
      if (typeof e.data === 'string') {
        if (e.data.startsWith('Reverted 0x'))
          // handle OpenEthereum revert data format
          return e.data.slice(9)

        if (e.data.startsWith('0x'))
          // handle new Geth format
          return e.data
      }

      // handle Ganache revert data format
      const txHash = Object.getOwnPropertyNames(e.data).filter((k) => k.startsWith('0x'))[0]
      return e.data[txHash].return
    }
  }

  ethCall(tx: EthCallTx, block: number | string): Promise<string> {
    // This is to workaround https://github.com/ethers-io/ethers.js/issues/819
    return this.providerSend('eth_call', [formatCallTx(tx), block])
  }

  async checkFromAddress(from: Address): Promise<void> {
    const { getAddress } = this.ethers.utils
    const expectedFrom = await this.getAccount()
    if (getAddress(from) !== expectedFrom) {
      throw new Error(`want from ${expectedFrom} but got from ${from}`)
    }
  }

  /**
   * Sends a transaction to the network.
   *
   * @param tx - Transaction to send
   * @returns The transaction response
   */
  async ethSendTransaction(tx: EthSendTx): Promise<EthersTransactionResult> {
    const { from, gas, ...sendTx } = normalizeGasLimit(tx)
    await this.checkFromAddress(from)
    const transactionResponse = await this.signer.sendTransaction({ gasLimit: gas, ...sendTx })
    return { transactionResponse, hash: transactionResponse.hash }
  }

  /**
   * Formats transaction result depending on the current provider.
   *
   * @param txHash - Transaction hash
   * @param tx - Transaction response
   * @returns The formatted transaction response
   */
  toSafeRelayTxResult(txHash: string, tx: Record<string, any>): Promise<EthersTransactionResult> {
    tx['hash'] = tx['txHash']
    delete tx['txHash']
    return new Promise((resolve, reject) =>
      resolve({
        transactionResponse: new Promise((resolve, reject) => resolve(tx)),
        hash: txHash
      })
    )
  }

  toRocksideRelayTxResult(tx: Record<string, any>): Promise<EthersTransactionResult> {
    tx['hash'] = tx['transaction_hash']
    delete tx['transaction_hash']
    return new Promise((resolve, reject) =>
      resolve({
        transactionResponse: new Promise((resolve, reject) => resolve(tx)),
        hash: tx['hash']
      })
    )
  }
}

export default EthersAdapter
