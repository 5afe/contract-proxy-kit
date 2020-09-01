import { Contract } from '../EthLibAdapter'
import { Web3TransactionResult, toTxResult } from './'
import { SendOptions, CallOptions, normalizeGasLimit } from '../../utils/transactions'
import { Address } from '../../utils/basicTypes'

class Web3ContractAdapter implements Contract {
  constructor(public contract: any) {}

  get address(): Address {
    return this.contract.options.address
  }

  call(methodName: string, params: any[], options?: CallOptions): Promise<any> {
    return this.contract.methods[methodName](...params).call(options && normalizeGasLimit(options))
  }

  send(methodName: string, params: any[], options?: SendOptions): Promise<Web3TransactionResult> {
    const promiEvent = this.contract.methods[methodName](...params).send(
      options && normalizeGasLimit(options)
    )
    return toTxResult(promiEvent, options)
  }

  async estimateGas(methodName: string, params: any[], options?: CallOptions): Promise<number> {
    return Number(
      await this.contract.methods[methodName](...params).estimateGas(
        options && normalizeGasLimit(options)
      )
    )
  }

  encode(methodName: string, params: any[]): string {
    return this.contract.methods[methodName](...params).encodeABI()
  }
}

export default Web3ContractAdapter
