import fetch from 'node-fetch'
import BigNumber from 'bignumber.js'
import EthLibAdapter from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import { OperationType } from '../utils/transactions'
import { bufferToHex, ecrecover, pubToAddress } from 'ethereumjs-util'

export interface SafeTransaction {
  to: Address
  value: number
  data: string
  operation: OperationType
  safeTxGas: number
  dataGas: number
  gasPrice: number
  gasToken: Address
  refundReceiver: Address
  nonce: number
}

interface TransactionEstimationsProps {
  safeTxRelayUrl: string
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

export const getTransactionHashSignature = async (
  ethLibAdapter: EthLibAdapter,
  ownerAccount: Address,
  txHash: string
) => {
  let signature = await ethLibAdapter.signMessage(txHash, ownerAccount)
  const hasPrefix = isTxHashSignedWithPrefix(txHash, signature, ownerAccount)

  let signatureV = parseInt(signature.slice(-2), 16)
  switch (signatureV) {
    case 0:
    case 1:
      signatureV += 31
      break
    case 27:
    case 28:
      if (hasPrefix) {
        signatureV += 4
      }
      break
    default:
      throw new Error('Invalid signature')
  }

  signature = signature.slice(0, -2) + signatureV.toString(16)
  return signature
}

export const getTransactionHashSignatureRSV = async (
  ethLibAdapter: EthLibAdapter,
  ownerAccount: Address,
  txHash: string
) => {
  const signature = await getTransactionHashSignature(ethLibAdapter, ownerAccount, txHash)

  return {
    r: new BigNumber('0x' + signature.slice(2, 66)).toString(10),
    s: new BigNumber('0x' + signature.slice(66, 130)).toString(10),
    v: new BigNumber('0x' + signature.slice(130, 132)).toString(10)
  }
}

const isTxHashSignedWithPrefix = (
  txHash: string,
  signature: string,
  ownerAccount: string
): boolean => {
  let hasPrefix
  try {
    const rsvSig = {
      r: Buffer.from(signature.slice(2, 66), 'hex'),
      s: Buffer.from(signature.slice(66, 130), 'hex'),
      v: parseInt(signature.slice(130, 132), 16)
    }
    const recoveredData = ecrecover(
      Buffer.from(txHash.slice(2), 'hex'),
      rsvSig.v,
      rsvSig.r,
      rsvSig.s
    )
    const recoveredAccount = bufferToHex(pubToAddress(recoveredData))
    hasPrefix = recoveredAccount.toLowerCase() !== ownerAccount.toLowerCase()
  } catch (e) {
    hasPrefix = true
  }
  return hasPrefix
}

export const getTransactionEstimations = async ({
  safeTxRelayUrl,
  safe,
  to,
  value,
  data,
  operation,
  gasToken
}: TransactionEstimationsProps): Promise<RelayEstimation> => {
  const url = `${safeTxRelayUrl}/api/v1/safes/${safe}/transactions/estimate/`
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
