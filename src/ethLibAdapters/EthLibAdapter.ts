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
  abstract keccak256(data: string): string

  abstract abiEncode(types: string[], values: any[]): string

  abstract abiDecode(types: string[], data: string): any[]

  abstract calcCreate2Address(deployer: Address, salt: string, initCode: string): string

  abstract getProvider(): any

  abstract providerSend(method: string, params: any[]): Promise<any>

  abstract signMessage(message: string, ownerAccount: Address): Promise<string>

  abstract getNetworkId(): Promise<number>

  abstract getAccount(): Promise<Address>

  abstract getCode(address: Address): Promise<string>

  abstract getBlock(blockHashOrBlockNumber: string | number): Promise<{ [property: string]: any }>

  abstract getContract(abi: Abi, address?: Address): Contract

  abstract getCallRevertData(tx: EthCallTx, block: string | number): Promise<string>

  abstract ethSendTransaction(tx: EthSendTx): Promise<TransactionResult>

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
