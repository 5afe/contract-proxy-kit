import should from 'should'
import { TransactionResult } from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { AccountType, toTxHashPromise } from '../utils'

export const testHelperMaker = (isCpkTransactionManager: boolean, web3Box: any): any => ({
  checkAddressChecksum: (address?: Address): boolean => {
    if (!address) {
      return false
    }
    return web3Box[0].utils.checkAddressChecksum(address)
  },
  sendTransaction: (txObj: any): any => toTxHashPromise(web3Box[0].eth.sendTransaction(txObj)),
  randomHexWord: (): string => web3Box[0].utils.randomHex(32),
  fromWei: (amount: number): number => Number(web3Box[0].utils.fromWei(amount)),
  getTransactionCount: (account: Address): number => web3Box[0].eth.getTransactionCount(account),
  testedTxObjProps: 'the PromiEvent for the transaction and the hash',
  getBalance: (address: Address): number =>
    web3Box[0].eth.getBalance(address).then((balance: number) => web3Box[0].utils.toBN(balance)),
  checkTxObj: (
    txsSize: number,
    accountType: AccountType,
    txResult: TransactionResult,
    isCpkTransactionManager: boolean
  ): void => {
    const safeConnected = accountType === AccountType.Connected
    should.exist(txResult.hash)
    if (!safeConnected || (safeConnected && txsSize === 1)) {
      should.exist(txResult.promiEvent)
      if (isCpkTransactionManager) {
        should.exist(txResult.sendOptions)
      }
    }
  },
  waitTxReceipt: async (txResult: TransactionResult): Promise<any> => {
    let receipt = await web3Box[0].eth.getTransactionReceipt(txResult.hash)
    while (!receipt) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      receipt = await web3Box[0].eth.getTransactionReceipt(txResult.hash)
    }
    return receipt
  },
  waitSafeTxReceipt: async (txResult: TransactionResult): Promise<any> => {
    let receipt: any
    if (!txResult.promiEvent) return
    if (isCpkTransactionManager) {
      receipt = await new Promise((resolve, reject) =>
        txResult.promiEvent
          .on('confirmation', (confirmationNumber: any, receipt: any) => resolve(receipt))
          .catch(reject)
      )
    } else {
      receipt = txResult.promiEvent.transactionHash
    }
    if (!receipt) return
    txResult.hash?.should.equal(receipt.transactionHash)
    return receipt
  }
})
