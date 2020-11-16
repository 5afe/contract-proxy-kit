import BigNumber from 'bignumber.js'
import fetch from 'node-fetch'
import EthLibAdapter from '../../ethLibAdapters/EthLibAdapter'
import { Address } from '../../utils/basicTypes'
import { zeroAddress } from '../../utils/constants'
import { TransactionResult } from '../../utils/transactions'
import TransactionManager, {
  ExecTransactionProps,
  TransactionManagerConfig,
  TransactionManagerNames
} from '../TransactionManager'
import { getTransactionEstimations, getTransactionHashSignatureRSV, SafeTransaction } from '../utils'

BigNumber.set({ EXPONENTIAL_AT: [-7, 255] })

interface SafeTxRelayManagerConfig {
  url: string
}

interface TransactionToRelayProps {
  url: string
  safeTransaction: SafeTransaction
  safe: Address
  signatures: any
  ethLibAdapter: EthLibAdapter
}

class SafeTxRelayManager implements TransactionManager {
  url: string

  constructor({ url }: SafeTxRelayManagerConfig) {
    if (!url) {
      throw new Error('url property missing from options')
    }
    this.url = url
  }

  get config(): TransactionManagerConfig {
    return {
      name: TransactionManagerNames.SafeTxRelayManager,
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

    const relayEstimations = await getTransactionEstimations({
      safeTxRelayUrl: this.url,
      safe: safeContract.address,
      to: safeExecTxParams.to,
      value: safeExecTxParams.value,
      data: safeExecTxParams.data,
      operation: safeExecTxParams.operation
    })

    // TO-DO: dataGas will be obsolete. Check again when this endpoint is updated to v2
    const safeTransaction: SafeTransaction = {
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

    const transactionHash = await contracts.safeContract.call('getTransactionHash', [
      safeTransaction.to,
      safeTransaction.value,
      safeTransaction.data,
      safeTransaction.operation,
      safeTransaction.safeTxGas,
      safeTransaction.dataGas,
      safeTransaction.gasPrice,
      safeTransaction.gasToken,
      safeTransaction.refundReceiver,
      safeTransaction.nonce
    ])

    const rsvSignature = await getTransactionHashSignatureRSV(ethLibAdapter, ownerAccount, transactionHash)

    return this.sendTransactionToRelay({
      url: this.url,
      safe: safeContract.address,
      safeTransaction,
      signatures: [rsvSignature],
      ethLibAdapter
    })
  }

  private async sendTransactionToRelay({
    safeTransaction,
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
      ...safeTransaction,
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
}

export default SafeTxRelayManager
