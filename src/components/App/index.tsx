import { Tab, TabItem, Title } from '@gnosis.pm/safe-react-components'
import BigNumber from 'bignumber.js'
import CpkInfo from 'components/CpkInfo'
import SafeModules from 'components/SafeModules'
import Transactions from 'components/Transactions'
import CPK, { /*RocksideTxRelayManager, SafeTxRelayManager,*/ TransactionManagerConfig, Web3Adapter } from 'contract-proxy-kit'
import { RocksideSpeed } from 'contract-proxy-kit/lib/cjs/transactionManagers/RocksideTxRelayManager'
import keccak256 from 'keccak256'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import Web3 from 'web3'
import ConnectButton from '../ConnectButton'

const Container = styled.div`
  padding: 10px;
`

const Line = styled.div`
  display: flex;
  justify-content: center;
`

export interface WalletState {
  isSafeApp?: boolean
  isProxyDeployed?: boolean
  saltNonce?: string
  cpkAddress?: string
  cpkBalance?: string
  ownerAddress?: string
  txManager?: TransactionManagerConfig
}

const initialWalletState: WalletState = {
  isSafeApp: undefined,
  isProxyDeployed: undefined,
  saltNonce: undefined,
  cpkAddress: undefined,
  cpkBalance: undefined,
  ownerAddress: undefined,
  txManager: undefined
}

const tabs: TabItem[] = [
  {
    id: '1',
    label: 'CPK Info',
    icon: 'info'
  },
  {
    id: '2',
    label: 'CPK Transactions',
    icon: 'transactionsInactive'
  },
  {
    id: '3',
    label: 'CPK Modules',
    icon: 'apps'
  }
]

const App = () => {
  const [selectedTab, setSelectedTab] = useState('1')
  const [enabledRocksideTxRelay, setEnabledRocksideTxRelay] = useState(false)
  const [web3, setWeb3] = React.useState<Web3 | undefined>(undefined)
  //const [saltNonce, setSaltNonce] = React.useState<string>('Contract Proxy Kit')
  const [cpk, setCpk] = useState<CPK | undefined>(undefined)
  const [walletState, updateWalletState] = useState<WalletState>(
    initialWalletState
  )

  const onWeb3Connect = (provider: any) => {
    if (provider) {
      setWeb3(new Web3(provider))
    }
  }

  const getEthBalance = useCallback(
    async (address?: string): Promise<string | undefined> => {
      if (!web3 || !address) return
      const ethBalance = new BigNumber(await web3.eth.getBalance(address))
      const ethDecimals = new BigNumber(10).pow(18)
      return (
        web3 && ethBalance.div(ethDecimals).decimalPlaces(7).toString() + ' ETH'
      )
    },
    [web3]
  )

  useEffect(() => {
    const initializeCpk = async () => {
      if (!web3) return
      let transactionManager
      const ethLibAdapter = new Web3Adapter({ web3 })
      //let formatedSaltNonce = saltNonce
      const networks = {
        3: {
          masterCopyAddress: '0x798960252148C0215F593c14b7c5B07183826212',
          proxyFactoryAddress: '0x8240eE136011392736920419cB7CB8bBadAc27E4',
          multiSendAddress: '0xe637DE43c1702fd59A2E7ab8F4224C7CBb0e9D3D',
          fallbackHandlerAddress: '0x83B1CB4017acf298b9Ff47FC4e380282738406B2'
        }
      }
      if (enabledRocksideTxRelay) {
        //transactionManager = new RocksideTxRelayManager({ speed: RocksideSpeed.Fastest })
        //transactionManager = new SafeTxRelayManager({ url: "http://localhost:8000" })
      }
      //if (saltNonce) {
      //  formatedSaltNonce = '0x' + keccak256(saltNonce).toString('hex')
      //}

      try {
        const newCpk = await CPK.create({
          networks,
          ethLibAdapter,
          transactionManager
          //saltNonce: formatedSaltNonce
        })
        setCpk(newCpk)
      } catch (e) {
        console.log(e)
      }
    }
    initializeCpk()
  }, [web3, /* saltNonce,*/ enabledRocksideTxRelay])

  useEffect(() => {
    const updateCpk = async () => {
      if (!cpk) return
      updateWalletState({
        isSafeApp: cpk.isSafeApp(),
        isProxyDeployed: await cpk.isProxyDeployed(),
        //saltNonce: await cpk.saltNonce,
        cpkAddress: cpk.address,
        cpkBalance: await getEthBalance(cpk.address),
        ownerAddress: await cpk.getOwnerAccount(),
      })
    }
    updateCpk()
  }, [cpk, getEthBalance])

  return (
    <Container>
      <Line>
        <Title size="sm">Contract Proxy Kit Configuration</Title>
      </Line>
      <ConnectButton onConnect={onWeb3Connect} />
      {cpk && (
        <>
          <Tab
            onChange={setSelectedTab}
            selectedTab={selectedTab}
            variant="outlined"
            items={tabs}
          />
          {selectedTab === '1' && (
            <CpkInfo
              walletState={walletState}
              //saltNonce={saltNonce}
              //setSaltNonce={setSaltNonce}
            />
          )}
          {selectedTab === '2' && (
            <Transactions
              cpk={cpk}
              walletState={walletState}
              enabledRocksideTxRelay={enabledRocksideTxRelay}
              setEnabledRocksideTxRelay={setEnabledRocksideTxRelay}
            />
          )}
          {selectedTab === '3' && (
            <SafeModules cpk={cpk} walletState={walletState} />
          )}
        </>
      )}
    </Container>
  )
}

export default App
