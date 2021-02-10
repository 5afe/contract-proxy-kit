import BigNumber from 'bignumber.js'
import { bufferToHex, ecrecover, pubToAddress } from 'ethereumjs-util'
import EthLibAdapter from '../ethLibAdapters/EthLibAdapter'
import { Address } from '../utils/basicTypes'
import { OperationType } from '../utils/transactions'

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
