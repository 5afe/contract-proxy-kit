import React, { useState, useEffect, useCallback } from 'react'
import CPK, { Web3Adapter, TransactionManagerConfig } from 'contract-proxy-kit'
import Web3 from 'web3'
import styled from 'styled-components'
import { BigNumber } from 'bignumber.js'
import { Title, TabItem, Tab } from '@gnosis.pm/safe-react-components'
import ConnectButton from '../ConnectButton'
import CpkInfo from 'components/CpkInfo'
import Transactions from 'components/Transactions'
import SafeModules from 'components/SafeModules'

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
  cpkAddress?: string
  cpkBalance?: string
  ownerAddress?: string
  txManager?: TransactionManagerConfig
}

const initialWalletState = {
  isSafeApp: undefined,
  isProxyDeployed: undefined,
  cpkAddress: undefined,
  cpkBalance: undefined,
  ownerAddress: undefined,
  txManager: undefined
}

const tabs: TabItem[] = [{
  id: "1",
  label: "CPK Info",
  icon: "info"
},
{
  id: "2",
  label: "CPK Transactions",
  icon: "transactionsInactive"
},
{
  id: "3",
  label: "CPK Modules",
  icon: "apps"
}]

const App = () => {
  const [selectedTab, setSelectedTab] = useState('1');
  const [web3, setWeb3] = React.useState<Web3 | undefined>(undefined)
  const [cpk, setCpk] = useState<CPK | undefined>(undefined)
  const [walletState, updateWalletState] = useState<WalletState>(initialWalletState)
  const network = 'rinkeby'

  const onWeb3Connect = (provider: any) => {
    if (provider) {
      setWeb3(new Web3(provider))
    }
  }

  const getEthBalance = useCallback(async (address?: string): Promise<string | undefined> => {
    if (!web3 || !address) return
    const ethBalance = new BigNumber(await web3.eth.getBalance(address))
    const ethDecimals = new BigNumber(10).pow(18)
    return web3 && ethBalance.div(ethDecimals).decimalPlaces(7).toString() + ' ETH'
  }, [web3])

  const updateCpk = useCallback(async (): Promise<void> => {
    if (!cpk) return
    updateWalletState({
      isSafeApp: cpk.isSafeApp(),
      isProxyDeployed: await cpk.isProxyDeployed(),
      cpkAddress: cpk.address,
      cpkBalance: await getEthBalance(cpk.address),
      ownerAddress: await cpk.getOwnerAccount()
    })
  }, [cpk, getEthBalance])

  const initializeCpk = useCallback(async (): Promise<void> => {
    if (!web3) return
    const ethLibAdapter = new Web3Adapter({ web3 })
    const newCpk = await CPK.create({ ethLibAdapter })
    setCpk(newCpk)
  }, [web3])

  useEffect(() => {
    initializeCpk()
  }, [initializeCpk])

  useEffect(() => {
    updateCpk()
  }, [updateCpk])

  return (
    <Container>
      <Line><Title size="sm">Contract Proxy Kit Configuration</Title></Line>
      <ConnectButton onConnect={onWeb3Connect} networkName={network}/>
      {cpk && (
        <>
          <Tab
            onChange={setSelectedTab}
            selectedTab={selectedTab}
            variant="outlined"
            items={tabs}
          />
          {selectedTab === "1" && <CpkInfo walletState={walletState} />}
          {selectedTab === "2" && <Transactions cpk={cpk} walletState={walletState} />}
          {selectedTab === "3" && <SafeModules cpk={cpk} walletState={walletState} />}
        </>
      )}
    </Container>
  )
}

export default App
