import Web3Maj1Min3 from 'web3-1-4'
import { EthersAdapter } from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { toTxHashPromise } from '../utils'

interface TestEthersAdapterProps {
  ethers: any
  defaultAccountBox: Address[]
  safeOwnerBox: Address[]
}

export function testEthersAdapter({
  ethers,
  defaultAccountBox,
  safeOwnerBox
}: TestEthersAdapterProps): void {
  describe(`with ethers version ${ethers.version}`, () => {
    const web3 = new Web3Maj1Min3('http://localhost:8545')
    const signer = ethers.Wallet.createRandom().connect(
      new ethers.providers.Web3Provider(web3.currentProvider)
    )
    const ethersAdapter = new EthersAdapter({ ethers, signer })

    it('should not produce ethLibAdapter instances when ethers not provided', async () => {
      ;((): EthersAdapter => new EthersAdapter({ signer } as any)).should.throw(
        'ethers property missing from options'
      )
    })

    it('should not produce ethLibAdapter instances when signer not provided', async () => {
      ;((): EthersAdapter => new EthersAdapter({ ethers } as any)).should.throw(
        'signer property missing from options'
      )
    })

    it('should return the ETH balance of an account', async () => {
      const address = safeOwnerBox[0]
      const initialEthBalance = await ethersAdapter.getBalance(address)
      const value = `${1e18}`
      await toTxHashPromise(
        web3.eth.sendTransaction({
          from: defaultAccountBox[0],
          to: address,
          value,
          gas: '0x5b8d80'
        })
      )
      const finalEthBalance = await ethersAdapter.getBalance(address)
      finalEthBalance.toString().should.equal(initialEthBalance.plus(value).toString())
    })
  })
}
