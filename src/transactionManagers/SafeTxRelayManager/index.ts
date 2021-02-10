import BigNumber from 'bignumber.js'
import EthLibAdapter from '../../ethLibAdapters/EthLibAdapter'
import { Address } from '../../utils/basicTypes'
import { zeroAddress } from '../../utils/constants'
import { HttpMethod, sendRequest } from '../../utils/httpRequests'
import { OperationType, TransactionResult } from '../../utils/transactions'
import TransactionManager, {
  ExecTransactionProps,
  TransactionManagerConfig,
  TransactionManagerNames
} from '../TransactionManager'

BigNumber.set({ EXPONENTIAL_AT: [-7, 255] })

interface SafeRelayTransactionManagerConfig {
  url: string
}

interface TransactionEstimationsProps {
  safe: Address
  to: Address
  value: string
  data: string
  operation: OperationType
  gasToken?: Address
}

interface RelayEstimation {
  safeTxGas: number
  baseGas: number
  dataGas: number
  operationalGas: number
  gasPrice: number
  lastUsedNonce: number
  gasToken: Address
}

interface TransactionToRelayProps {
  url: string
  tx: any
  safe: Address
  signatures: any
  ethLibAdapter: EthLibAdapter
}

class SafeRelayTransactionManager implements TransactionManager {
  url: string

  /**
   * Initializes an instance of the Safe Relay Transaction Manager.
   *
   * @param options - The URL pointing to the Safe Transaction Service
   * @returns The SafeRelayTransactionManager instance
   */
  constructor(options: SafeRelayTransactionManagerConfig) {
    const { url } = options
    if (!url) {
      throw new Error('url property missing from options')
    }
    this.url = url
  }

  /**
   * Returns the configuration of the Safe Relay Transaction Manager.
   *
   * @returns The name of the TransactionManager in use and the URL of the service
   */
  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.SafeTxRelayManager,
      url: this.url
    }
  }

  /**
   * Executes a list of transactions via the Safe Transaction Relay.
   *
   * @param options
   * @returns The transaction response
   */
  async execTransactions({
    ownerAccount,
    safeExecTxParams,
    contractManager,
    ethLibAdapter,
    isConnectedToSafe
  }: ExecTransactionProps): Promise<TransactionResult> {
    const { contract } = contractManager
    if (!contract) {
      throw new Error('CPK Proxy contract uninitialized')
    }

    if (isConnectedToSafe) {
      throw new Error(
        'The use of the relay service is not supported when the CPK is connected to a Gnosis Safe'
      )
    }

    const relayEstimations = await this.getTransactionEstimations({
      safe: contract.address,
      to: safeExecTxParams.to,
      value: new BigNumber(safeExecTxParams.value).toString(10),
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation
    })

    // TO-DO: dataGas will be obsolete. Check again when this endpoint is updated to v2
    const tx = {
      to: safeExecTxParams.to,
      value: new BigNumber(safeExecTxParams.value).toString(10),
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation,
      safeTxGas: relayEstimations.safeTxGas,
      dataGas: relayEstimations.baseGas,
      gasPrice: relayEstimations.gasPrice,
      gasToken: relayEstimations.gasToken,
      refundReceiver: zeroAddress,
      nonce: relayEstimations.lastUsedNonce + 1
    }

    const txHash = await contract.call('getTransactionHash', [
      tx.to,
      tx.value,
      tx.data,
      tx.operation,
      tx.safeTxGas,
      tx.dataGas,
      tx.gasPrice,
      tx.gasToken,
      tx.refundReceiver,
      tx.nonce
    ])

    const rsvSignature = await this.signTransactionHash(ethLibAdapter, ownerAccount, txHash)

    return this.sendTransactionToRelay({
      url: this.url,
      safe: contract.address,
      tx,
      signatures: [rsvSignature],
      ethLibAdapter
    })
  }

  private async getTransactionEstimations({
    safe,
    to,
    value,
    data,
    operation,
    gasToken
  }: TransactionEstimationsProps): Promise<RelayEstimation> {
    const body: { [key: string]: any } = {
      safe,
      to,
      value,
      data,
      operation
    }
    if (gasToken) {
      body.gasToken = gasToken
    }

    const jsonResponse = await sendRequest({
      url: `${this.url}/api/v1/safes/${safe}/transactions/estimate/`,
      method: HttpMethod.POST,
      body: JSON.stringify(body),
      expectedHttpCodeResponse: 200
    })

    return jsonResponse
  }

  private async sendTransactionToRelay({
    tx,
    safe,
    signatures,
    ethLibAdapter
  }: TransactionToRelayProps): Promise<any> {
    const jsonResponse = await sendRequest({
      url: `${this.url}/api/v1/safes/${safe}/transactions/`,
      method: HttpMethod.POST,
      body: JSON.stringify({ safe, ...tx, signatures }),
      expectedHttpCodeResponse: 201
    })

    return ethLibAdapter.toSafeRelayTxResult(jsonResponse.txHash, jsonResponse.ethereumTx)
  }

  private async signTransactionHash(
    ethLibAdapter: EthLibAdapter,
    ownerAccount: Address,
    txHash: string
  ) {
    let sig = await ethLibAdapter.signMessage(txHash, ownerAccount)
    let sigV = parseInt(sig.slice(-2), 16)

    switch (sigV) {
      case 0:
      case 1:
        sigV += 31
        break
      case 27:
      case 28:
        sigV += 4
        break
      default:
        throw new Error('Invalid signature')
    }

    sig = sig.slice(0, -2) + sigV.toString(16)

    return {
      r: new BigNumber('0x' + sig.slice(2, 66)).toString(10),
      s: new BigNumber('0x' + sig.slice(66, 130)).toString(10),
      v: new BigNumber('0x' + sig.slice(130, 132)).toString(10)
    }
  }
}

export default SafeRelayTransactionManager
