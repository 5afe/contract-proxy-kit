import BigNumber from 'bignumber.js'
import { rocksideTxRelayUrl } from '../../config/transactionManagers'
import EthLibAdapter from '../../ethLibAdapters/EthLibAdapter'
import { Address } from '../../utils/basicTypes'
import { zeroAddress } from '../../utils/constants'
import { HttpMethod, sendRequest } from '../../utils/httpRequests'
import { TransactionResult } from '../../utils/transactions'
import TransactionManager, {
  ExecTransactionProps,
  TransactionManagerConfig,
  TransactionManagerNames
} from '../TransactionManager'
import { getTransactionHashSignature } from '../utils'

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
    contractManager,
    ethLibAdapter
  }: ExecTransactionProps): Promise<TransactionResult> {
    const { contract } = contractManager
    if (!contract) {
      throw new Error('CPK Proxy contract uninitialized')
    }

    let network
    const networkId = await ethLibAdapter.getNetworkId()
    switch (networkId) {
      case 1:
        network = 'mainnet'
        break
      case 3:
        network = 'ropsten'
        break
      default:
        throw new Error('Network not supported when using Rockside transaction relay')
    }

    const nonce = await contract.call('nonce', [])

    const txRelayParams = await this.getTxRelayParams(contract.address, network)

    const safeTransaction = {
      to: safeExecTxParams.to,
      value: safeExecTxParams.value,
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: Number(txRelayParams.gas_price),
      gasToken: zeroAddress,
      refundReceiver: txRelayParams.relayer,
      nonce
    }

    const transactionHash = await contract.call('getTransactionHash', [
      safeTransaction.to,
      new BigNumber(safeExecTxParams.value).toString(10),
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.baseGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      safeTransaction.nonce
    ])

    const signatures = await getTransactionHashSignature(
      ethLibAdapter,
      ownerAccount,
      transactionHash
    )

    const data = contract.encode('execTransaction', [
      safeTransaction.to,
      new BigNumber(safeExecTxParams.value).toString(10),
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.baseGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      signatures
    ])

    const trackingId = await this.sendTxToRelay(contract.address, data, network)
    return this.followTransaction(network, trackingId, ethLibAdapter)
  }

  private async getTxRelayParams(
    safeAccount: string,
    network: string
  ): Promise<TxRelayParamsResult> {
    const jsonResponse = await sendRequest({
      url: `${rocksideTxRelayUrl}/ethereum/${network}/relay/${safeAccount}/params`,
      method: HttpMethod.GET,
      expectedHttpCodeResponse: 200
    })

    return jsonResponse.speeds[this.#speed]
  }

  private async sendTxToRelay(
    safeAccount: Address,
    data: string,
    network: string
  ): Promise<string> {
    const jsonResponse = await sendRequest({
      url: `${rocksideTxRelayUrl}/ethereum/${network}/relay/${safeAccount}`,
      method: HttpMethod.POST,
      body: JSON.stringify({ data, speed: this.#speed }),
      expectedHttpCodeResponse: 200
    })

    return jsonResponse.tracking_id
  }

  private async followTransaction(
    network: string,
    trackingId: string,
    ethLibAdapter: EthLibAdapter
  ): Promise<any> {
    const jsonResponse = await sendRequest({
      url: `${rocksideTxRelayUrl}/ethereum/${network}/transactions/${trackingId}`,
      method: HttpMethod.GET,
      expectedHttpCodeResponse: 200
    })

    return ethLibAdapter.toRocksideRelayTxResult(jsonResponse)
  }
}

export default RocksideRelayTransactionManager
