import should from 'should'
import CPK, { TransactionResult } from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { getContracts } from '../utils/contracts'

interface TestConnectedSafeTransactionsWithRelayProps {
  web3: any
  getCPK: () => CPK
  checkAddressChecksum: (address?: Address) => any
  sendTransaction: (txObj: any) => any
  randomHexWord: () => string
  fromWei: (amount: number) => number
  testedTxObjProps: string
  waitTxReceipt: (txResult: TransactionResult) => Promise<any>
  ownerIsRecognizedContract?: boolean
}

export function testConnectedSafeTransactionsWithRelay({
  web3,
  getCPK,
  checkAddressChecksum,
  sendTransaction,
  randomHexWord,
  fromWei,
  testedTxObjProps,
  waitTxReceipt,
  ownerIsRecognizedContract
}: TestConnectedSafeTransactionsWithRelayProps): void {
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

    beforeEach(async () => {
      cpk = await getCPK()
      const pOwner = await cpk.getOwnerAccount()
      if (!pOwner) throw new Error('proxyOwner is undefined')
      proxyOwner = pOwner
    })

    before('deploy conditional tokens', async () => {
      conditionalTokens = await getContracts().ConditionalTokens.new()
    })

    beforeEach(async () => {
      multiStep = await getContracts().MultiStep.new()
      erc20 = await getContracts().ERC20Mintable.new()
      await erc20.mint(proxyOwner, `${1e20}`)
    })

    beforeEach(async () => {
      const hash = await sendTransaction({
        from: proxyOwner,
        to: erc20.address,
        value: 0,
        gas: '0x5b8d80',
        data: erc20.contract.methods.approve(cpk.address, `${1e20}`).encodeABI()
      })
      await waitTxReceipt({ hash })
    })

    it("can't execute a single transaction", async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      await cpk
        .execTransactions([
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI()
          }
        ])
        .should.be.rejectedWith(
          /The use of the relay service is not supported when the CPK is connected to a Gnosis Safe/
        )
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
    })

    it("can't execute deep transactions", async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
      const numSteps = 10

      await cpk
        .execTransactions([
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doDeepStep(numSteps, numSteps, cpk.address).encodeABI()
          }
        ])
        .should.be.rejectedWith(
          /The use of the relay service is not supported when the CPK is connected to a Gnosis Safe/
        )
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
    })

    it("can't batch transactions together", async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      await cpk
        .execTransactions([
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI()
          },
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(2).encodeABI()
          }
        ])
        .should.be.rejectedWith(
          /The use of the relay service is not supported when the CPK is connected to a Gnosis Safe/
        )
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)
    })

    it("can't batch ERC20 transactions", async () => {
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      await cpk
        .execTransactions([
          {
            to: erc20.address,
            data: erc20.contract.methods
              .transferFrom(proxyOwner, cpk.address, `${3e18}`)
              .encodeABI()
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
        ])
        .should.be.rejectedWith(
          /The use of the relay service is not supported when the CPK is connected to a Gnosis Safe/
        )
      ;(await multiStep.lastStepFinished(cpk.address)).toNumber().should.equal(0)

      fromWei(await erc20.balanceOf(cpk.address)).should.equal(100)
      fromWei(await erc20.balanceOf(multiStep.address)).should.equal(0)
    })

    it("can't batch ERC-1155 token interactions", async () => {
      const questionId = randomHexWord()
      const conditionId: string = web3.utils.soliditySha3(
        { t: 'address', v: cpk.address },
        { t: 'bytes32', v: questionId },
        { t: 'uint', v: 2 }
      )

      await cpk
        .execTransactions([
          {
            to: erc20.address,
            data: erc20.contract.methods
              .transferFrom(proxyOwner, cpk.address, `${3e18}`)
              .encodeABI()
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
        ])
        .should.be.rejectedWith(
          /The use of the relay service is not supported when the CPK is connected to a Gnosis Safe/
        )

      fromWei(await erc20.balanceOf(cpk.address)).should.equal(100)
      fromWei(await erc20.balanceOf(conditionalTokens.address)).should.equal(0)
    })

    it(`does not return an object with ${testedTxObjProps} when doing a transaction`, async () => {
      await cpk
        .execTransactions([
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI()
          }
        ])
        .should.be.rejectedWith(
          /The use of the relay service is not supported when the CPK is connected to a Gnosis Safe/
        )
    })
  })
}
