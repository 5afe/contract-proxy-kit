import BigNumber from 'bignumber.js'
import { Abi, Address } from '../../utils/basicTypes'
import {
  EthCallTx,
  EthSendTx,
  formatCallTx,
  normalizeGasLimit,
  SendOptions,
  Web3TransactionResult
} from '../../utils/transactions'
import EthLibAdapter, { Contract } from '../EthLibAdapter'
import Web3ContractAdapter from './Web3ContractAdapter'

export function toTxResult(
  promiEvent: any,
  sendOptions?: SendOptions
): Promise<Web3TransactionResult> {
  return new Promise((resolve, reject) =>
    promiEvent
      .once('transactionHash', (hash: string) => resolve({ sendOptions, promiEvent, hash }))
      .catch(reject)
  )
}

export interface Web3AdapterConfig {
  web3: any
}

class Web3Adapter extends EthLibAdapter {
  web3: any

  /**
   * Creates an instance of Web3Adapter
   *
   * @param options - Web3Adapter configuration
   * @returns The Web3Adapter instance
   */
  constructor({ web3 }: Web3AdapterConfig) {
    super()

    if (!web3) {
      throw new Error('web3 property missing from options')
    }
    this.web3 = web3
  }

  /**
   * Returns the current provider
   *
   * @returns The current provider
   */
  getProvider(): any {
    return this.web3.currentProvider
  }

  /**
   * Sends a network request via JSON-RPC.
   *
   * @param method - JSON-RPC method
   * @param params - Params
   * @returns The request response
   */
  providerSend(method: string, params: any[]): Promise<any> {
    // TO-DO: Use semver comparison
    return this.web3.version.split('.')[0] > 1
      ? this.web3.currentProvider.send(method, params)
      : new Promise((resolve, reject) =>
          this.web3.currentProvider.send(
            {
              jsonrpc: '2.0',
              id: new Date().getTime(),
              method,
              params
            },
            (err: any, result: any) => {
              if (err) return reject(err)
              if (result.error) return reject(result.error)
              return resolve(result.result)
            }
          )
        )
  }

  /**
   * Signs data using a specific account.
   *
   * @param message - Data to sign
   * @param ownerAccount - Address to sign the data with
   * @returns The signature
   */
  signMessage(message: string, ownerAccount: Address): Promise<string> {
    return this.web3.eth.sign(message, ownerAccount)
  }

  /**
   * Returns the current network ID.
   *
   * @returns The network ID
   */
  async getNetworkId(): Promise<number> {
    return this.web3.eth.net.getId()
  }

  /**
   * Returns the default account used as the default "from" property.
   *
   * @returns The default account address
   */
  async getAccount(): Promise<Address> {
    return this.web3.eth.defaultAccount || (await this.web3.eth.getAccounts())[0]
  }

  /**
   * Returns the balance of an address.
   *
   * @param address - The desired address
   * @returns The balance of the address
   */
  async getBalance(address: Address): Promise<BigNumber> {
    return new BigNumber(await this.web3.eth.getBalance(address))
  }

  /**
   * Returns the keccak256 hash of the data.
   *
   * @param data - Desired data
   * @returns The keccak256 of the data
   */
  keccak256(data: string): string {
    return this.web3.utils.keccak256(data)
  }

  /**
   * Encodes a function parameters based on its JSON interface object.
   *
   * @param types - An array with the types or a JSON interface of a function
   * @param values - The parameters to encode
   * @returns The ABI encoded parameters
   */
  abiEncode(types: string[], values: any[]): string {
    return this.web3.eth.abi.encodeParameters(types, values)
  }

  /**
   * Decodes ABI encoded parameters to is JavaScript types.
   *
   * @param types - An array with the types or a JSON interface outputs array
   * @param data - The ABI byte code to decode
   * @returns The ABI encoded parameters
   */
  abiDecode(types: string[], data: string): any[] {
    return this.web3.eth.abi.decodeParameters(types, data)
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
    return this.web3.utils.toChecksumAddress(
      this.web3.utils
        .soliditySha3(
          '0xff',
          { t: 'address', v: deployer },
          { t: 'bytes32', v: salt },
          this.keccak256(initCode)
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
    return this.web3.eth.getCode(address)
  }

  /**
   * Returns a block matching the block number or block hash.
   *
   * @param blockHashOrBlockNumber - The block number or block hash
   * @returns The block object
   */
  getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }> {
    return this.web3.eth.getBlock(blockHashOrBlockNumber)
  }

  /**
   * Returns an instance of a contract.
   *
   * @param abi - ABI of the desired contract
   * @param address - Contract address
   * @returns The contract instance
   */
  getContract(abi: Abi, address: Address): Contract {
    const contract = new this.web3.eth.Contract(abi, address)
    return new Web3ContractAdapter(contract)
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
      // this block handles old Geth/Ganache --noVMErrorsOnRPCResponse
      // use a low level eth_call instead of web3.eth.call so
      // full error data from eth node is available if provider is Web3 1.x
      return await this.providerSend('eth_call', [formatCallTx(tx), block])
    } catch (e) {
      let errData = e.data
      if (!errData && e.message.startsWith('Node error: ')) {
        // parse out error data from eth node if provider is Web3 2.x
        errData = JSON.parse(e.message.slice(12)).data
      }

      if (typeof errData === 'string') {
        if (errData.startsWith('Reverted 0x'))
          // handle OpenEthereum revert data format
          return errData.slice(9)

        if (errData.startsWith('0x'))
          // handle new Geth format
          return errData
      }

      // handle Ganache revert data format
      const txHash = Object.getOwnPropertyNames(errData).filter((k) => k.startsWith('0x'))[0]
      return errData[txHash].return
    }
  }

  /**
   * Sends a transaction to the network.
   *
   * @param tx - Transaction to send
   * @returns The transaction response
   */
  ethSendTransaction(tx: EthSendTx): Promise<Web3TransactionResult> {
    return toTxResult(this.web3.eth.sendTransaction(normalizeGasLimit(tx)), tx)
  }

  /**
   * Formats transaction result depending on the current provider.
   *
   * @param txHash - Transaction hash
   * @param tx - Transaction response
   * @returns The formatted transaction response
   */
  toSafeRelayTxResult(txHash: string, tx: Record<string, any>): Promise<Web3TransactionResult> {
    tx['transactionHash'] = tx['txHash']
    delete tx['txHash']
    return new Promise((resolve, reject) =>
      resolve({
        promiEvent: new Promise((resolve, reject) => resolve(tx)),
        hash: txHash
      })
    )
  }

  toRocksideRelayTxResult(tx: Record<string, any>): Promise<Web3TransactionResult> {
    tx['transactionHash'] = tx['transaction_hash']
    delete tx['transaction_hash']
    return new Promise((resolve, reject) =>
      resolve({
        promiEvent: new Promise((resolve, reject) => resolve(tx)),
        hash: tx['transactionHash']
      })
    )
  }
}

export default Web3Adapter
