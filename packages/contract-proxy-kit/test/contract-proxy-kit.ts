import { SafeInfo } from '@gnosis.pm/safe-apps-sdk'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ethers as ethersMaj4 } from 'ethers-4'
import { ethers as ethersMaj5 } from 'ethers-5'
import should from 'should'
import Web3Maj1Min3 from 'web3-1-4'
import Web3Maj2Alpha from 'web3-2-alpha'
import CPK, { SafeTxRelayManager, Web3Adapter } from '../src'
import { Address } from '../src/utils/basicTypes'
import { zeroAddress } from '../src/utils/constants'
import { testCpkWithEthers } from './ethers/shouldWorkWithEthers'
import { testEthersAdapter } from './ethers/testEthersAdapter'
import {
  getContractInstances,
  getContracts,
  initializeContracts,
  TestContractInstances
} from './utils/contracts'
import makeEmulatedSafeProvider from './utils/makeEmulatedSafeProvider'
import { testCpkWithWeb3 } from './web3/shouldWorkWithWeb3'
import { testWeb3Adapter } from './web3/testWeb3Adapter'
chai.use(chaiAsPromised)

const web3Versions = [Web3Maj1Min3, Web3Maj2Alpha]
const ethersVersions = [ethersMaj4, ethersMaj5]

describe('Contract Proxy Kit', () => {
  let web3: any
  const defaultAccountBox: Address[] = []
  const safeOwnerBox: Address[] = []
  let contracts: TestContractInstances
  const gnosisSafeProviderBox: any[] = []

  before('initialize user accounts', async () => {
    web3 = new Web3Maj1Min3('http://localhost:8545')
    const accounts = await web3.eth.getAccounts()

    // First account is used as the Safe relayer account
    defaultAccountBox[0] = accounts[2]
    safeOwnerBox[0] = accounts[3]
  })

  before('initialize contracts', async () => {
    await initializeContracts(safeOwnerBox[0])
    contracts = getContractInstances()
  })

  before('emulate Gnosis Safe WalletConnect provider', async () => {
    const { gnosisSafe, defaultCallbackHandler, gnosisSafeProxyFactory, multiSend } = contracts
    const safeSetupData = gnosisSafe.contract.methods
      .setup(
        [safeOwnerBox[0]],
        1,
        zeroAddress,
        '0x',
        defaultCallbackHandler.address,
        zeroAddress,
        0,
        zeroAddress
      )
      .encodeABI()
    const { logs } = await gnosisSafeProxyFactory.createProxy(gnosisSafe.address, safeSetupData, {
      from: safeOwnerBox[0]
    })
    const proxyCreationEvents = logs.find(({ event }: { event: any }) => event === 'ProxyCreation')
    const safeAddress: Address = proxyCreationEvents && proxyCreationEvents.args.proxy
    const safeSignature = `0x000000000000000000000000${safeOwnerBox[0]
      .replace(/^0x/, '')
      .toLowerCase()}000000000000000000000000000000000000000000000000000000000000000001`
    const safe = await getContracts().GnosisSafe.at(safeAddress)
    const emulatedSafeProvider = makeEmulatedSafeProvider({
      web3,
      safe,
      safeAddress,
      safeOwnerBox,
      safeMasterCopy: gnosisSafe,
      multiSend,
      safeSignature
    })
    gnosisSafeProviderBox[0] = emulatedSafeProvider
  })

  it('should exist', () => {
    should.exist(CPK)
  })

  it('should produce uninitialized CPK instances when running standalone and options are missing', async () => {
    const cpk = await CPK.create(undefined as any)
    should.exist(cpk)
    should.not.exist(cpk.ethLibAdapter)
    should.not.exist(cpk.contractManager?.contract)
    should.not.exist(cpk.contractManager?.multiSend)
    should.not.exist(cpk.contractManager?.proxyFactory)
    should.not.exist(cpk.contractManager?.masterCopyAddress)
    should.not.exist(cpk.contractManager?.fallbackHandlerAddress)
    cpk.safeAppsSdkConnector?.isSafeApp.should.equal(false)
  })

  it.skip('should produce CPK instances when running as a Safe App and options are missing', async () => {
    // Test fails because the window.postMessage is not received in the safe-apps-sdk
    const cpk = await CPK.create(undefined as any)

    const message: SafeInfo = {
      safeAddress: '0x0000000000000000000000000000000000000001',
      network: 'RINKEBY'
    }
    window.postMessage({ messageId: 'ON_SAFE_INFO', message }, '*')

    should.exist(cpk)
    should.exist(cpk.ethLibAdapter)
    should.exist(cpk.address)
    cpk.address?.should.equal(message.safeAddress)
    should.not.exist(cpk.contractManager?.contract)
    should.not.exist(cpk.contractManager?.multiSend)
    should.not.exist(cpk.contractManager?.proxyFactory)
    should.not.exist(cpk.contractManager?.masterCopyAddress)
    should.not.exist(cpk.contractManager?.fallbackHandlerAddress)
    cpk.safeAppsSdkConnector?.isSafeApp.should.equal(true)
  })

  it.skip('should produce CPK instances when running as a Safe App', async () => {
    // Test fails because the window.postMessage is not received in the safe-apps-sdk
    const cpk = await CPK.create({
      ethLibAdapter: new Web3Adapter({ web3 }),
      ownerAccount: '0x0000000000000000000000000000000000000002'
    })

    const message: SafeInfo = {
      safeAddress: '0x0000000000000000000000000000000000000001',
      network: 'RINKEBY'
    }
    window.postMessage({ messageId: 'ON_SAFE_INFO', message }, '*')

    should.exist(cpk)
    should.exist(cpk.ethLibAdapter)
    should.exist(cpk.address)
    cpk.address?.should.equal(message.safeAddress)
    should.not.exist(cpk.contractManager?.contract)
    should.not.exist(cpk.contractManager?.multiSend)
    should.not.exist(cpk.contractManager?.proxyFactory)
    should.not.exist(cpk.contractManager?.masterCopyAddress)
    should.not.exist(cpk.contractManager?.fallbackHandlerAddress)
    should.exist(cpk.safeAppsSdkConnector)
    cpk.safeAppsSdkConnector?.isSafeApp.should.equal(true)
  })

  it('should not produce CPK instances when ethLibAdapter not provided', async () => {
    await CPK.create({} as any).should.be.rejectedWith(
      'ethLibAdapter property missing from options'
    )
  })

  it('should not produce SafeTxRelayManager instances when url not provided', async () => {
    ;(() => new SafeTxRelayManager({} as any)).should.throw('url property missing from options')
  })

  describe('EthLibAdapters', () => {
    web3Versions.forEach((Web3) => testWeb3Adapter({ Web3, defaultAccountBox, safeOwnerBox }))
    ethersVersions.forEach((ethers) =>
      testEthersAdapter({ ethers, defaultAccountBox, safeOwnerBox })
    )
  })

  describe('CPK with Transaction Manager', () => {
    web3Versions.forEach((Web3) => {
      testCpkWithWeb3({
        Web3,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox
      })
    })
    ethersVersions.forEach((ethers) => {
      testCpkWithEthers({
        ethers,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox
      })
    })
  })
/*
  describe('CPK with Safe Relay Transaction Manager', () => {
    const transactionManager = new SafeTxRelayManager({ url: 'http://localhost:8000' })
    web3Versions.forEach((Web3) => {
      testCpkWithWeb3({
        Web3,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox,
        transactionManager
      })
    })
    ethersVersions.forEach((ethers) => {
      testCpkWithEthers({
        ethers,
        defaultAccountBox,
        safeOwnerBox,
        gnosisSafeProviderBox,
        transactionManager
      })
    })
  })
*/
})
