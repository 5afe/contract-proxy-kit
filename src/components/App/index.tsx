import { Tab, TabItem, Title } from '@gnosis.pm/safe-react-components'
import BigNumber from 'bignumber.js'
import CpkInfo from 'components/CpkInfo'
import SafeModules from 'components/SafeModules'
import Transactions from 'components/Transactions'
import CPK, { RocksideSpeed, RocksideTxRelayManager, TransactionManagerConfig, Web3Adapter } from 'contract-proxy-kit'
import keccak256 from 'keccak256'
import React, { useEffect, useState } from 'react'
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
  contractVersion?: string,
  cpkAddress?: string
  cpkBalance?: BigNumber
  networkId?: number
  ownerAddress?: string
  txManager?: TransactionManagerConfig
}

const initialWalletState: WalletState = {
  isSafeApp: undefined,
  isProxyDeployed: undefined,
  saltNonce: undefined,
  contractVersion: undefined,
  cpkAddress: undefined,
  cpkBalance: undefined,
  networkId: undefined,
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
  const [saltNonce, setSaltNonce] = React.useState<string>('Contract Proxy Kit')
  const [cpk, setCpk] = useState<CPK | undefined>(undefined)
  const [walletState, updateWalletState] = useState<WalletState>(
    initialWalletState
  )

  const onWeb3Connect = (provider: any) => {
    if (provider) {
      setWeb3(new Web3(provider))
    }
  }

  useEffect(() => {
    const initializeCpk = async () => {
      if (!web3) return
      let transactionManager
      let formatedSaltNonce = saltNonce
      if (saltNonce) {
        formatedSaltNonce = '0x' + keccak256(saltNonce).toString('hex')
      }
      const ethLibAdapter = new Web3Adapter({ web3 })

      const networks = {
        3: {
          masterCopyAddress: '0x798960252148C0215F593c14b7c5B07183826212',
          proxyFactoryAddress: '0x8240eE136011392736920419cB7CB8bBadAc27E4',
          multiSendAddress: '0xe637DE43c1702fd59A2E7ab8F4224C7CBb0e9D3D',
          fallbackHandlerAddress: '0x83B1CB4017acf298b9Ff47FC4e380282738406B2'
        }
      }
      if (enabledRocksideTxRelay) {
        transactionManager = new RocksideTxRelayManager({ speed: RocksideSpeed.Fastest })
      }

      const newCpk = await CPK.create({ ethLibAdapter, networks, saltNonce: formatedSaltNonce })
      setCpk(newCpk)
    }
    initializeCpk()
  }, [web3, saltNonce, enabledRocksideTxRelay])

  useEffect(() => {
    const updateCpk = async () => {
      if (!cpk) return
      const isProxyDeployed = await cpk.isProxyDeployed()
      updateWalletState({
        isSafeApp: cpk.safeAppsSdkConnector?.isSafeApp,
        isProxyDeployed,
        saltNonce: await cpk.saltNonce,
        contractVersion: isProxyDeployed ? (await cpk.getContractVersion()) : undefined,
        cpkAddress: await cpk.address,
        cpkBalance: await cpk.getBalance(),
        networkId: await cpk.getNetworkId(),
        ownerAddress: await cpk.getOwnerAccount()
      })
    }
    updateCpk()
  }, [cpk])

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
              saltNonce={saltNonce}
              setSaltNonce={setSaltNonce}
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
