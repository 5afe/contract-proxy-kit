import should from 'should'
import CPK, { TransactionResult } from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { AccountType } from '../utils'
import { getContracts } from '../utils/contracts'

interface TestSafeTransactionsProps {
  web3: any
  getCPK: () => CPK
  checkAddressChecksum: (address?: Address) => any
  sendTransaction: (txObj: any) => any
  randomHexWord: () => string
  fromWei: (amount: number) => number
  getTransactionCount: (account: Address) => number
  getBalance: (address: Address) => any
  testedTxObjProps: string
  checkTxObj: (
    txsSize: number,
    accountType: AccountType,
    txResult: TransactionResult,
    isCpkTransactionManager: boolean
  ) => void
  waitTxReceipt: (txResult: TransactionResult) => Promise<any>
  waitSafeTxReceipt: (txResult: TransactionResult) => Promise<any>
  ownerIsRecognizedContract?: boolean
  isCpkTransactionManager: boolean
  executor?: Address[]
  accountType: AccountType
}

export function testSafeTransactions({
  web3,
  getCPK,
  checkAddressChecksum,
  sendTransaction,
  randomHexWord,
  fromWei,
  getTransactionCount,
  getBalance,
  testedTxObjProps,
  checkTxObj,
  waitTxReceipt,
  waitSafeTxReceipt,
  ownerIsRecognizedContract,
  isCpkTransactionManager,
  executor,
  accountType
}: TestSafeTransactionsProps): void {
  it('can get checksummed address of instance', async () => {
    const cpk = await getCPK()
    should.exist(cpk.address)
    checkAddressChecksum(cpk.address).should.be.true()
  })

  if (ownerIsRecognizedContract) {
    it("has same owner as instance's address", async () => {
      const cpk = await getCPK()
      const proxyOwner = await cpk.getOwnerAccount()
      should.exist(proxyOwner)
      proxyOwner?.should.be.equal(cpk.address)
    })
  }

  describe('with mock contracts', () => {
    let cpk: CPK
    let proxyOwner: Address
    let conditionalTokens: any
    let multiStep: any
    let erc20: any
    let dailyLimitModule: any

    beforeEach('rebind symbols', async () => {
      cpk = await getCPK()
      const pOwner = await cpk.getOwnerAccount()
      if (!pOwner) throw new Error('proxyOwner is undefined')
      proxyOwner = pOwner
    })

    before('deploy conditional tokens and daily limit module', async () => {
      conditionalTokens = await getContracts().ConditionalTokens.new()
      dailyLimitModule = await getContracts().DailyLimitModule.new()
    })

    beforeEach('deploy mock contracts', async () => {
      multiStep = await getContracts().MultiStep.new()
      erc20 = await getContracts().ERC20Mintable.new()
      await erc20.mint(proxyOwner, `${1e20}`)
    })

    beforeEach('give proxy ERC20 allowance', async () => {
      const hash = await sendTransaction({
        from: proxyOwner,
        to: erc20.address,
        value: 0,
        gas: '0x5b8d80',
        data: erc20.contract.methods.approve(cpk.address, `${1e20}`).encodeABI()
      })
      await waitTxReceipt({ hash })
    })

    it('can execute a single transaction', async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      const txs = [
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI()
        }
      ]
      const txResult = await cpk.execTransactions(txs)

      checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(1)
    })

    it('can execute deep transactions', async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
      const numSteps = 10

      const txs = [
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doDeepStep(numSteps, numSteps, cpk.address).encodeABI()
        }
      ]
      const txResult = await cpk.execTransactions(txs)

      checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(numSteps)
    })

    it('can batch transactions together', async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      const txs = [
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI()
        },
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(2).encodeABI()
        }
      ]
      const txResult = await cpk.execTransactions(txs)

      checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(2)
    })

    it('can batch ERC20 transactions', async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      const txs = [
        {
          to: erc20.address,
          data: erc20.contract.methods.transferFrom(proxyOwner, cpk.address, `${3e18}`).encodeABI()
        },
        {
          to: erc20.address,
          data: erc20.contract.methods.approve(multiStep.address, `${3e18}`).encodeABI()
        },
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI()
        },
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doERC20Step(2, erc20.address).encodeABI()
        }
      ]
      const txResult = await cpk.execTransactions(txs)

      checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(2)

      if (cpk.address === proxyOwner) {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(98)
      } else {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(1)
        fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97)
      }
      fromWei(await erc20.balanceOf(multiStep.address)).should.equal(2)
    })

    it('can batch ERC-1155 token interactions', async () => {
      const questionId = randomHexWord()
      const conditionId: string = web3.utils.soliditySha3(
        { t: 'address', v: cpk.address },
        { t: 'bytes32', v: questionId },
        { t: 'uint', v: 2 }
      )

      const txs = [
        {
          to: erc20.address,
          data: erc20.contract.methods.transferFrom(proxyOwner, cpk.address, `${3e18}`).encodeABI()
        },
        {
          to: erc20.address,
          data: erc20.contract.methods.approve(conditionalTokens.address, `${1e18}`).encodeABI()
        },
        {
          to: conditionalTokens.address,
          data: conditionalTokens.contract.methods
            .prepareCondition(cpk.address, questionId, 2)
            .encodeABI()
        },
        {
          to: conditionalTokens.address,
          data: conditionalTokens.contract.methods
            .splitPosition(erc20.address, `0x${'0'.repeat(64)}`, conditionId, [1, 2], `${1e18}`)
            .encodeABI()
        }
      ]
      const txResult = await cpk.execTransactions(txs)

      checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)

      if (cpk.address === proxyOwner) {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(99)
      } else {
        fromWei(await erc20.balanceOf(cpk.address)).should.equal(2)
        fromWei(await erc20.balanceOf(proxyOwner)).should.equal(97)
      }
      fromWei(await erc20.balanceOf(conditionalTokens.address)).should.equal(1)
    })
    ;(ownerIsRecognizedContract ? it.skip : it)(
      'by default errors without transacting when single transaction would fail',
      async () => {
        ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
        const startingTransactionCount = await getTransactionCount(proxyOwner)

        const errorMessage =
          isCpkTransactionManager || (!isCpkTransactionManager && accountType === AccountType.Fresh)
            ? /must do the next step/
            : /CannotEstimateGas/

        await cpk
          .execTransactions([
            {
              to: multiStep.address,
              data: multiStep.contract.methods.doStep(2).encodeABI()
            }
          ])
          .should.be.rejectedWith(errorMessage)
        ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
        await getTransactionCount(proxyOwner).should.eventually.equal(startingTransactionCount)
      }
    )
    ;(ownerIsRecognizedContract ? it.skip : it)(
      'by default errors without transacting when any transaction in batch would fail',
      async () => {
        ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
        const startingTransactionCount = await getTransactionCount(proxyOwner)

        const errorMessage =
          isCpkTransactionManager || (!isCpkTransactionManager && accountType === AccountType.Fresh)
            ? /(proxy creation and )?batch transaction execution expected to fail/
            : /CannotEstimateGas/

        await cpk
          .execTransactions([
            {
              to: multiStep.address,
              data: multiStep.contract.methods.doStep(1).encodeABI()
            },
            {
              to: multiStep.address,
              data: multiStep.contract.methods.doStep(3).encodeABI()
            }
          ])
          .should.be.rejectedWith(errorMessage)
        ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
        await getTransactionCount(proxyOwner).should.eventually.equal(startingTransactionCount)
      }
    )

    it(`returns an object with ${testedTxObjProps} when doing a transaction`, async () => {
      const txs = [
        {
          to: multiStep.address,
          data: multiStep.contract.methods.doStep(1).encodeABI()
        }
      ]
      const txResult = await cpk.execTransactions(txs)

      checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)
    })
    ;(!isCpkTransactionManager ? it.skip : it)(
      'can execute a single transaction with a specific gas price',
      async () => {
        const startingBalance = await getBalance((executor && executor[0]) || proxyOwner)

        ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

        const txs = [
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI()
          }
        ]
        const gasPrice = 123
        const txResult = await cpk.execTransactions(txs, { gasPrice })
        checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
        const receipt = await waitTxReceipt(txResult)
        const { gasUsed } = receipt

        const endingBalance = await getBalance((executor && executor[0]) || proxyOwner)
        const gasCosts = startingBalance.sub(endingBalance).toNumber()

        gasCosts.should.be.equal(gasPrice * gasUsed)
      }
    )
    ;(!isCpkTransactionManager || ownerIsRecognizedContract ? it.skip : it)(
      'can execute a batch transaction with a specific gas price',
      async () => {
        const startingBalance = await getBalance((executor && executor[0]) || proxyOwner)

        ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

        const txs = [
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI()
          },
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(2).encodeABI()
          }
        ]
        const gasPrice = 123
        const txResult = await cpk.execTransactions(txs, { gasPrice })
        checkTxObj(txs.length, accountType, txResult, isCpkTransactionManager)
        const receipt = await waitTxReceipt(txResult)
        const { gasUsed } = receipt

        const endingBalance = await getBalance((executor && executor[0]) || proxyOwner)
        const gasCosts = startingBalance.sub(endingBalance).toNumber()

        gasCosts.should.be.equal(gasPrice * gasUsed)
      }
    )

    it('can enable modules', async () => {
      let moduleList: Address[]

      if (accountType !== AccountType.Fresh) {
        moduleList = await cpk.getModules()
        moduleList.length.should.equal(0)
        ;(await cpk.isModuleEnabled(dailyLimitModule.address)).should.equal(false)
      } else {
        await sendTransaction({
          from: await cpk.getOwnerAccount(),
          to: cpk.address,
          value: '0xde0b6b3a7640000',
          gas: '0x5b8d80'
        })
      }

      const txResult = await cpk.enableModule(dailyLimitModule.address)
      checkTxObj(1, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)

      moduleList = await cpk.getModules()
      moduleList.length.should.equal(1)
      ;(await cpk.isModuleEnabled(dailyLimitModule.address)).should.equal(true)
    })
    ;(accountType === AccountType.Fresh ? it.skip : it)('can disable modules', async () => {
      let moduleList: Address[]

      moduleList = await cpk.getModules()
      moduleList.length.should.equal(1)
      ;(await cpk.isModuleEnabled(dailyLimitModule.address)).should.equal(true)

      const txResult = await cpk.disableModule(dailyLimitModule.address)
      checkTxObj(1, accountType, txResult, isCpkTransactionManager)
      await waitSafeTxReceipt(txResult)

      moduleList = await cpk.getModules()
      moduleList.length.should.equal(0)
      ;(await cpk.isModuleEnabled(dailyLimitModule.address)).should.equal(false)
    })
  })
}
