import should from 'should'
import Web3Maj1Min3 from 'web3-1-3'
import CPK, {
  EthersAdapter,
  NetworksConfig,
  Transaction,
  TransactionManager,
  TransactionResult
} from '../../src'
import { Address } from '../../src/utils/basicTypes'
import { testConnectedSafeTransactionsWithRelay } from '../transactions/testConnectedSafeTransactionsWithRelay'
import { testSafeTransactions } from '../transactions/testSafeTransactions'
import { AccountType, toTxHashPromise } from '../utils'
import { getContractInstances, TestContractInstances } from '../utils/contracts'

interface ShouldWorkWithEthersProps {
  ethers: any
  defaultAccountBox: Address[]
  safeOwnerBox: Address[]
  gnosisSafeProviderBox: any
  transactionManager?: TransactionManager
}

export function shouldWorkWithEthers({
  ethers,
  defaultAccountBox,
  safeOwnerBox,
  gnosisSafeProviderBox,
  transactionManager
}: ShouldWorkWithEthersProps): void {
  describe(`with ethers version ${ethers.version}`, () => {
    let contracts: TestContractInstances
    const web3 = new Web3Maj1Min3('http://localhost:8545')
    const isCpkTransactionManager =
      !transactionManager || transactionManager.config.name === 'CpkTransactionManager'

    const signer = ethers.Wallet.createRandom().connect(
      new ethers.providers.Web3Provider(web3.currentProvider)
    )

    const ethersTestHelpers = (signerBox: any[]): any => ({
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
      fromWei: (amount: number): number =>
        Number(ethers.utils.formatUnits(amount.toString(), 'ether')),
      getTransactionCount: (address: Address): Promise<number> =>
        signer.provider.getTransactionCount(address),
      getBalance: (address: Address): Promise<number> => signer.provider.getBalance(address),
      testedTxObjProps: 'the TransactionResponse and the hash',
      checkTxObj: (
        txsSize: number,
        accountType: AccountType,
        txResult: TransactionResult
      ): void => {
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

    before('setup contracts', async () => {
      contracts = getContractInstances()
    })

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

    it('should not produce CPK instances when ethers not connected to a recognized network', async () => {
      const ethLibAdapter = new EthersAdapter({ ethers, signer })
      await CPK.create({ ethLibAdapter }).should.be.rejectedWith(/Unrecognized network ID \d+/)
    })

    describe('with valid networks configuration', () => {
      let networks: NetworksConfig

      before('obtain addresses from artifacts', async () => {
        const { gnosisSafe, gnosisSafe2, cpkFactory, multiSend, defaultCallbackHandler } = contracts

        networks = {
          [(await signer.provider.getNetwork()).chainId]: {
            masterCopyAddressVersions: [
              {
                address: gnosisSafe.address,
                version: '1.2.0'
              },
              {
                address: gnosisSafe2.address,
                version: '1.1.1'
              }
            ],
            proxyFactoryAddress: cpkFactory.address,
            multiSendAddress: multiSend.address,
            fallbackHandlerAddress: defaultCallbackHandler.address
          }
        }
      })

      it('can produce instances', async () => {
        const ethLibAdapter = new EthersAdapter({ ethers, signer })
        should.exist(ethLibAdapter)
        should.exist(await CPK.create({ ethLibAdapter, networks }))
        should.exist(await CPK.create({ ethLibAdapter, transactionManager, networks }))
      })

      it('should instantiate SafeAppsSdkConnector when isSafeApp is not set', async () => {
        const ethLibAdapter = new EthersAdapter({ ethers, signer })
        const cpk = await CPK.create({ ethLibAdapter, networks })
        should.exist(cpk.safeAppsSdkConnector)
      })

      it('should not instantiate SafeAppsSdkConnector when isSafeApp configuration param is set to false', async () => {
        const ethLibAdapter = new EthersAdapter({ ethers, signer })
        const cpk = await CPK.create({ ethLibAdapter, networks, isSafeApp: false })
        should.not.exist(cpk.safeAppsSdkConnector)
      })

      it('can encode multiSend call data', async () => {
        const { multiStep } = contracts
        const transactions: Transaction[] = [
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(1).encodeABI()
          },
          {
            to: multiStep.address,
            data: multiStep.contract.methods.doStep(2).encodeABI()
          }
        ]

        const ethLibAdapter = new EthersAdapter({ ethers, signer })
        const uninitializedCPK = new CPK({ ethLibAdapter })
        const dataHash = uninitializedCPK.encodeMultiSendCallData(transactions)

        const multiStepAddress = multiStep.address.slice(2).toLowerCase()
        dataHash.should.be.equal(
          `0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000f200${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf093000000000000000000000000000000000000000000000000000000000000000100${multiStepAddress}00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000024c01cf09300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000`
        )
      })

      describe('with warm instance', () => {
        let cpk: CPK

        before('fund owner/signer', async () => {
          await toTxHashPromise(
            web3.eth.sendTransaction({
              from: defaultAccountBox[0],
              to: signer.address,
              value: `${3e18}`,
              gas: '0x5b8d80'
            })
          )
        })

        before('create instance', async () => {
          const ethLibAdapter = new EthersAdapter({ ethers, signer })

          cpk = await CPK.create({
            ethLibAdapter,
            transactionManager,
            networks
          })

          await toTxHashPromise(
            web3.eth.sendTransaction({
              from: defaultAccountBox[0],
              to: cpk.address,
              value: `${5e18}`
            })
          )
        })

        before('warm instance', async () => {
          const idPrecompile = `0x${'0'.repeat(39)}4`
          await cpk.execTransactions([
            {
              to: idPrecompile
            }
          ])
        })

        testSafeTransactions({
          web3,
          ...ethersTestHelpers([signer]),
          async getCPK() {
            return cpk
          },
          defaultAccount: defaultAccountBox,
          isCpkTransactionManager,
          accountType: AccountType.Warm
        })
      })

      describe('with fresh accounts', () => {
        const freshSignerBox: any[] = []
        testSafeTransactions({
          web3,
          ...ethersTestHelpers(freshSignerBox),
          async getCPK() {
            freshSignerBox[0] = ethers.Wallet.createRandom().connect(
              new ethers.providers.Web3Provider(web3.currentProvider)
            )

            await toTxHashPromise(
              web3.eth.sendTransaction({
                from: defaultAccountBox[0],
                to: freshSignerBox[0].address,
                value: `${3e18}`,
                gas: '0x5b8d80'
              })
            )

            const ethLibAdapter = new EthersAdapter({ ethers, signer: freshSignerBox[0] })
            const cpk = await CPK.create({ ethLibAdapter, transactionManager, networks })

            await toTxHashPromise(
              web3.eth.sendTransaction({
                from: defaultAccountBox[0],
                to: cpk.address,
                value: `${5e18}`
              })
            )

            return cpk
          },
          defaultAccount: defaultAccountBox,
          isCpkTransactionManager,
          accountType: AccountType.Fresh
        })
      })

      describe('with mock connected to a Gnosis Safe provider', () => {
        const safeSignerBox: any[] = []

        before('create Web3 instance', async () => {
          const provider = new ethers.providers.Web3Provider(gnosisSafeProviderBox[0])
          safeSignerBox[0] = provider.getSigner()
        })

        let cpk: CPK

        before('create instance', async () => {
          const ethLibAdapter = new EthersAdapter({ ethers, signer: safeSignerBox[0] })
          cpk = await CPK.create({ ethLibAdapter, transactionManager, networks })

          await toTxHashPromise(
            web3.eth.sendTransaction({
              from: defaultAccountBox[0],
              to: cpk.address,
              value: `${5e18}`
            })
          )
        })

        if (!isCpkTransactionManager) {
          testConnectedSafeTransactionsWithRelay({
            web3,
            ...ethersTestHelpers(safeSignerBox),
            async getCPK() {
              return cpk
            },
            ownerIsRecognizedContract: true,
            executor: safeOwnerBox,
            defaultAccount: defaultAccountBox,
            isCpkTransactionManager,
            accountType: AccountType.Connected
          })
          return
        }

        testSafeTransactions({
          web3,
          ...ethersTestHelpers(safeSignerBox),
          async getCPK() {
            return cpk
          },
          ownerIsRecognizedContract: true,
          executor: safeOwnerBox,
          defaultAccount: defaultAccountBox,
          isCpkTransactionManager,
          accountType: AccountType.Connected
        })
      })
    })
  })
}
