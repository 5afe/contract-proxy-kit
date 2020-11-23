import fetch from 'node-fetch'
import { rocksideTxRelayUrl, safeTxRelayUrl } from '../../config/transactionManagers'
import EthLibAdapter from '../../ethLibAdapters/EthLibAdapter'
import { Address } from '../../utils/basicTypes'
import { zeroAddress } from '../../utils/constants'
import { TransactionResult } from '../../utils/transactions'
import TransactionManager, {
  ExecTransactionProps,
  TransactionManagerConfig,
  TransactionManagerNames
} from '../TransactionManager'
import { getTransactionEstimations, getTransactionHashSignature } from '../utils'

export enum RocksideSpeed {
  Fast = 'fast',
  Fastest = 'fastest',
  Safelow = 'safelow',
  Standard = 'standard'
}

interface RocksideRelayTxManagerConfig {
  speed: RocksideSpeed
}

interface TxRelayParamsResult {
  gas_price: string
  relayer: Address
}

class RocksideRelayTransactionManager implements TransactionManager {
  #speed: string

  constructor({ speed }: RocksideRelayTxManagerConfig) {
    this.#speed = speed
  }

  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.RocksideTxRelayManager,
      speed: this.#speed
    }
  }

  async execTransactions({
    ownerAccount,
    safeExecTxParams,
    contracts,
    ethLibAdapter
  }: ExecTransactionProps): Promise<TransactionResult> {
    const { safeContract } = contracts

    let network
    const networkId = await ethLibAdapter.getNetworkId()
    switch (networkId) {
      case 1: 
        network = 'mainnet'
        break
      //case 3:
      //  network = 'ropsten'
      //  break
      default:
        throw new Error('Network not supported when using Rockside transaction relay')
    }
    
    const relayEstimations = await getTransactionEstimations({
      safeTxRelayUrl,
      safe: safeContract.address,
      to: safeExecTxParams.to,
      value: safeExecTxParams.value,
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation
    })
    console.log({relayEstimations})

    const txRelayParams = await this.getTxRelayParams(safeContract.address, network)
    console.log({txRelayParams})

    const safeTransaction = {
      to: safeExecTxParams.to,
      value: safeExecTxParams.value,
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation,
      safeTxGas: relayEstimations.safeTxGas,
      baseGas: relayEstimations.baseGas,
      gasPrice: Number(txRelayParams.gas_price),
      gasToken: zeroAddress,
      refundReceiver: txRelayParams.relayer,
      nonce: relayEstimations.lastUsedNonce + 1
    }
    console.log({safeTransaction})

    const transactionHash = await contracts.safeContract.call('getTransactionHash', [
      safeTransaction.to,
      safeTransaction.value,
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.baseGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      safeTransaction.nonce
    ])
    console.log({transactionHash})

    const signatures = await getTransactionHashSignature(
      ethLibAdapter,
      ownerAccount,
      transactionHash
    )
    console.log({signatures})

    const data = safeContract.encode('execTransaction', [
      safeTransaction.to,
      safeTransaction.value,
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.baseGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      signatures
    ])
    console.log({data})

    return this.sendTxToRelay(safeContract.address, data, ethLibAdapter, network)
  }

  private async getTxRelayParams(
    safeAccount: string,
    network: string
  ): Promise<TxRelayParamsResult> {
    const url = `${rocksideTxRelayUrl}/ethereum/${network}/relay/${safeAccount}/params`
    const headers = {
      'Content-Type': 'application/json'
    }

    const response = await fetch(url, {
      method: 'GET',
      headers
    })

    const jsonResponse = await response.json()

    if (response.status !== 200) {
      throw new Error(jsonResponse.exception)
    }
    return jsonResponse.speeds[this.#speed]
  }

  private async sendTxToRelay(
    safeAccount: Address,
    data: string,
    ethLibAdapter: EthLibAdapter,
    network: string
  ): Promise<any> {
    const url = `${rocksideTxRelayUrl}/ethereum/${network}/relay/${safeAccount}`
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    const body = {
      data,
      speed: this.#speed
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    const jsonResponse = await response.json()

    if (response.status !== 200) {
      throw new Error(jsonResponse.exception)
    }
    return ethLibAdapter.toSafeRelayTxResult(jsonResponse.transaction_hash, {})
  }
}

export default RocksideRelayTransactionManager
