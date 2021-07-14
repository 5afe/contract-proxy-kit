import should from 'should'
import { TransactionResult } from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { AccountType } from '../utils'

export const ethersTestHelpers = (ethers: any, signer: any, signerBox: any[]): any => ({
  checkAddressChecksum: (address?: Address): boolean => {
    if (!address) {
      return false
    }
    return ethers.utils.getAddress(address) === address
  },
  sendTransaction: async ({
    from,
    gas,
    ...txObj
  }: {
    from: Address
    gas: number
  }): Promise<any> => {
    const signer = signerBox[0]
    const expectedFrom = await signer.getAddress()
    if (from && from.toLowerCase() !== expectedFrom.toLowerCase()) {
      throw new Error(`from ${from} doesn't match signer ${expectedFrom}`)
    }

    if (signer.constructor.name === 'JsonRpcSigner') {
      // mock Gnosis Safe provider
      return (await signer.sendTransaction({ gasLimit: gas, ...txObj })).hash
    }

    // See: https://github.com/ethers-io/ethers.js/issues/299
    const nonce: number = await signer.provider.getTransactionCount(await signer.getAddress())

    let signedTx: string
    // TO-DO: Use semver comparison
    if (ethers.version.split('.')[0] === '4') {
      signedTx = await signer.sign({ nonce, gasLimit: gas, ...txObj })
    } else if (ethers.version.split('.')[0] === 'ethers/5') {
      signedTx = await signer.signTransaction({ nonce, gasLimit: gas, ...txObj })
    } else throw new Error(`ethers version ${ethers.version} not supported`)

    return (await signer.provider.sendTransaction(signedTx)).hash
  },
  randomHexWord: (): string => ethers.utils.hexlify(ethers.utils.randomBytes(32)),
  fromWei: (amount: number): number => Number(ethers.utils.formatUnits(amount.toString(), 'ether')),
  getTransactionCount: (address: Address): Promise<number> =>
    signer.provider.getTransactionCount(address),
  getBalance: (address: Address): Promise<number> => signer.provider.getBalance(address),
  testedTxObjProps: 'the TransactionResponse and the hash',
  checkTxObj: (txsSize: number, accountType: AccountType, txResult: TransactionResult): void => {
    const safeConnected = accountType === AccountType.Connected
    should.exist(txResult.hash)
    if (!safeConnected || (safeConnected && txsSize === 1)) {
      should.exist(txResult.transactionResponse)
    }
  },
  waitTxReceipt: (txResult: TransactionResult): any =>
    signer.provider.waitForTransaction(txResult.hash),
  waitSafeTxReceipt: async (txResult: TransactionResult): Promise<any> => {
    if (!txResult.transactionResponse) return
    const receipt = await txResult.transactionResponse
    if (!receipt) return
    txResult.hash?.should.equal(receipt.hash)
    return receipt
  }
})
