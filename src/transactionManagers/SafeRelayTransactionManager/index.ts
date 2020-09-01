import fetch from 'node-fetch'
import BigNumber from 'bignumber.js'
import TransactionManager, {
  ExecTransactionProps,
  TransactionManagerConfig,
  TransactionManagerNames
} from '../TransactionManager'
import { TransactionResult, OperationType } from '../../utils/transactions'
import { zeroAddress } from '../../utils/constants'
import { Address } from '../../utils/basicTypes'
import EthLibAdapter from '../../ethLibAdapters/EthLibAdapter'

BigNumber.set({ EXPONENTIAL_AT: [-7, 255] })

interface SafeRelayTransactionManagerConfig {
  url: string
}

interface TransactionEstimationsProps {
  safe: Address
  to: Address
  value: number
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

  constructor({ url }: SafeRelayTransactionManagerConfig) {
    if (!url) {
      throw new Error('url property missing from options')
    }
    this.url = url
  }

  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.SafeRelayTransactionManager,
      url: this.url
    }
  }

  async execTransactions({
    ownerAccount,
    safeExecTxParams,
    contracts,
    ethLibAdapter,
    isConnectedToSafe
  }: ExecTransactionProps): Promise<TransactionResult> {
    const { safeContract } = contracts

    if (isConnectedToSafe) {
      throw new Error(
        'The use of the relay service is not supported when the CPK is connected to a Gnosis Safe'
      )
    }

    const relayEstimations = await this.getTransactionEstimations({
      safe: safeContract.address,
      to: safeExecTxParams.to,
      value: safeExecTxParams.value,
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation
    })

    // TO-DO: dataGas will be obsolete. Check again when this endpoint is updated to v2
    const tx = {
      to: safeExecTxParams.to,
      value: safeExecTxParams.value,
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation,
      safeTxGas: relayEstimations.safeTxGas,
      dataGas: relayEstimations.baseGas,
      gasPrice: relayEstimations.gasPrice,
      gasToken: relayEstimations.gasToken,
      refundReceiver: zeroAddress,
      nonce: relayEstimations.lastUsedNonce + 1
    }

    const txHash = await contracts.safeContract.call('getTransactionHash', [
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
      safe: safeContract.address,
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
    const url = this.url + '/api/v1/safes/' + safe + '/transactions/estimate/'
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' }
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

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    const jsonResponse = await response.json()

    if (response.status !== 200) {
      throw new Error(jsonResponse.exception)
    }
    return jsonResponse
  }

  private async sendTransactionToRelay({
    tx,
    safe,
    signatures,
    ethLibAdapter
  }: TransactionToRelayProps): Promise<any> {
    const url = this.url + '/api/v1/safes/' + safe + '/transactions/'
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
    const body = {
      safe,
      ...tx,
      signatures
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    const jsonResponse = await response.json()

    if (response.status !== 201) {
      throw new Error(jsonResponse.exception)
    }
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
