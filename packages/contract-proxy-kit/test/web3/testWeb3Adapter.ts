import Web3Maj1Min3 from 'web3-1-4'
import Web3Maj2Alpha from 'web3-2-alpha'
import { Web3Adapter } from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { testHelperMaker } from './utils'

interface TestWeb3AdapterProps {
  Web3: typeof Web3Maj1Min3 | typeof Web3Maj2Alpha
  defaultAccountBox: Address[]
  safeOwnerBox: Address[]
}

export function testWeb3Adapter({
  Web3,
  defaultAccountBox,
  safeOwnerBox
}: TestWeb3AdapterProps): void {
  describe(`with Web3 version ${new Web3(Web3.givenProvider).version}`, () => {
    const web3 = new Web3('http://localhost:8545')
    const web3Adapter = new Web3Adapter({ web3 })
    const ueb3TestHelpers = testHelperMaker(true, [web3])

    it('should not produce ethLibAdapter instances when web3 not provided', async () => {
      ;((): Web3Adapter => new Web3Adapter({} as any)).should.throw(
        'web3 property missing from options'
      )
    })

    it('should return the ETH balance of an account', async () => {
      const address = safeOwnerBox[0]
      const initialEthBalance = await web3Adapter.getBalance(address)
      const value = `${1e18}`
      await ueb3TestHelpers.sendTransaction({
        from: defaultAccountBox[0],
        to: address,
        value
      })
      const finalEthBalance = await web3Adapter.getBalance(address)
      finalEthBalance.toString().should.equal(initialEthBalance.plus(value).toString())
    })
  })
}
