import BigNumber from 'bignumber.js'
import { Abi, Address } from '../utils/basicTypes'
import { joinHexData } from '../utils/hexData'
import {
  CallOptions,
  EthCallTx,
  EthSendTx,
  SendOptions,
  TransactionResult
} from '../utils/transactions'

export interface Contract {
  address: Address
  call(methodName: string, params: any[], options?: CallOptions): Promise<any>
  send(methodName: string, params: any[], options?: SendOptions): Promise<TransactionResult>
  estimateGas(methodName: string, params: any[], options?: CallOptions): Promise<number>
  encode(methodName: string, params: any[]): string
}

abstract class EthLibAdapter {
  /**
   * Returns the keccak256 hash of the data.
   *
   * @param data - Desired data
   * @returns The keccak256 of the data
   */
  abstract keccak256(data: string): string

  /**
   * Encodes a function parameters based on its JSON interface object.
   *
   * @param types - An array with the types or a JSON interface of a function
   * @param values - The parameters to encode
   * @returns The ABI encoded parameters
   */
  abstract abiEncode(types: string[], values: any[]): string

  /**
   * Decodes ABI encoded parameters to is JavaScript types.
   *
   * @param types - An array with the types or a JSON interface outputs array
   * @param data - The ABI byte code to decode
   * @returns The ABI encoded parameters
   */
  abstract abiDecode(types: string[], data: string): any[]

  /**
   * Deterministically returns the address where a contract will be deployed.
   *
   * @param deployer - Account that deploys the contract
   * @param salt - Salt
   * @param initCode - Code to be deployed
   * @returns The address where the contract will be deployed
   */
  abstract calcCreate2Address(deployer: Address, salt: string, initCode: string): string

  /**
   * Returns the current provider
   *
   * @returns The current provider
   */
  abstract getProvider(): any

  /**
   * Sends a network request via JSON-RPC.
   *
   * @param method - JSON-RPC method
   * @param params - Params
   * @returns The request response
   */
  abstract providerSend(method: string, params: any[]): Promise<any>

  /**
   * Signs data using a specific account.
   *
   * @param message - Data to sign
   * @param ownerAccount - Address to sign the data with
   * @returns The signature
   */
  abstract signMessage(message: string, ownerAccount: Address): Promise<string>

  /**
   * Returns the current network ID.
   *
   * @returns The network ID
   */
  abstract getNetworkId(): Promise<number>

  /**
   * Returns the default account used as the default "from" property.
   *
   * @returns The default account address
   */
  abstract getAccount(): Promise<Address>

  /**
   * Returns the balance of an address.
   *
   * @param address - The desired address
   * @returns The balance of the address
   */
  abstract getBalance(address: Address): Promise<BigNumber>

  /**
   * Returns the code at a specific address.
   *
   * @param address - The desired address
   * @returns The code of the contract
   */
  abstract getCode(address: Address): Promise<string>

  /**
   * Returns a block matching the block number or block hash.
   *
   * @param blockHashOrBlockNumber - The block number or block hash
   * @returns The block object
   */
  abstract getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }>

  /**
   * Returns an instance of a contract.
   *
   * @param abi - ABI of the desired contract
   * @param address - Contract address
   * @returns The contract instance
   */
  abstract getContract(abi: Abi, address?: Address): Contract

  /**
   * Returns the revert reason when a call fails.
   *
   * @param tx - Transaction to execute
   * @param block - Block number
   * @returns The revert data when the call fails
   */
  abstract getCallRevertData(tx: EthCallTx, block: string | number): Promise<string>

  /**
   * Sends a transaction to the network.
   *
   * @param tx - Transaction to send
   * @returns The transaction response
   */
  abstract ethSendTransaction(tx: EthSendTx): Promise<TransactionResult>

  /**
   * Formats transaction result depending on the current provider.
   *
   * @param txHash - Transaction hash
   * @param tx - Transaction response
   * @returns The formatted transaction response
   */
  abstract toSafeRelayTxResult(txHash: string, tx: Record<string, any>): Promise<TransactionResult>

  abstract toRocksideRelayTxResult(tx: Record<string, any>): Promise<TransactionResult>

  abiEncodePacked(...params: { type: string; value: any }[]): string {
    return joinHexData(
      params.map(({ type, value }) => {
        const encoded = this.abiEncode([type], [value])

        if (type === 'bytes' || type === 'string') {
          const bytesLength = parseInt(encoded.slice(66, 130), 16)
          return encoded.slice(130, 130 + 2 * bytesLength)
        }

        let typeMatch = type.match(/^(?:u?int\d*|bytes\d+|address)\[\]$/)
        if (typeMatch) {
          return encoded.slice(130)
        }

        if (type.startsWith('bytes')) {
          const bytesLength = parseInt(type.slice(5))
          return encoded.slice(2, 2 + 2 * bytesLength)
        }

        typeMatch = type.match(/^u?int(\d*)$/)
        if (typeMatch) {
          if (typeMatch[1] !== '') {
            const bytesLength = parseInt(typeMatch[1]) / 8
            return encoded.slice(-2 * bytesLength)
          }
          return encoded.slice(-64)
        }

        if (type === 'address') {
          return encoded.slice(-40)
        }

        throw new Error(`unsupported type ${type}`)
      })
    )
  }

  decodeError(revertData: string): string {
    if (!revertData.startsWith('0x08c379a0')) throw new Error('Unrecognized error format')

    return this.abiDecode(['string'], `0x${revertData.slice(10)}`)[0]
  }
}

export default EthLibAdapter
