import { Address } from '../../utils/basicTypes'
import {
  CallOptions,
  EthersTransactionResult,
  normalizeGasLimit,
  SendOptions
} from '../../utils/transactions'
import { Contract } from '../EthLibAdapter'
import EthersAdapter from './'

class EthersV4ContractAdapter implements Contract {
  constructor(public contract: any, public ethersAdapter: EthersAdapter) {}

  get address(): Address {
    return this.contract.address
  }

  async call(methodName: string, params: any[], options?: CallOptions): Promise<any> {
    const data = this.encode(methodName, params)
    const resHex = await this.ethersAdapter.ethCall(
      {
        ...options,
        to: this.address,
        data
      },
      'latest'
    )
    const rets = this.contract.interface.functions[methodName].decode(resHex)

    if (rets.length === 1) {
      return rets[0]
    }

    return rets
  }

  async send(
    methodName: string,
    params: any[],
    options?: SendOptions
  ): Promise<EthersTransactionResult> {
    let transactionResponse
    if (options) {
      const { from, gas, ...sendOptions } = normalizeGasLimit(options)
      await this.ethersAdapter.checkFromAddress(from)
      transactionResponse = await this.contract.functions[methodName](...params, {
        gasLimit: gas,
        ...sendOptions
      })
    } else {
      transactionResponse = await this.contract.functions[methodName](...params)
    }
    return { transactionResponse, hash: transactionResponse.hash }
  }

  async estimateGas(methodName: string, params: any[], options?: CallOptions): Promise<number> {
    if (!options) {
      return (await this.contract.estimate[methodName](...params)).toNumber()
    } else {
      const { gas, ...callOptions } = normalizeGasLimit(options)
      return (
        await this.contract.estimate[methodName](...params, { gasLimit: gas, ...callOptions })
      ).toNumber()
    }
  }

  encode(methodName: string, params: any[]): string {
    return this.contract.interface.functions[methodName].encode(params)
  }
}

export default EthersV4ContractAdapter
