import React, { useState, useEffect } from 'react'
import CPK, { Web3Adapter, TransactionManagerConfig } from 'contract-proxy-kit'
import Web3 from 'web3'
import ConnectButton from '../ConnectButton'
import useCustomReducer from 'hooks/useCustomReducer'
import CpkTransactions from 'components/CpkTransactions'
import CpkInfo from 'components/CpkInfo'
import { BigNumber } from 'bignumber.js'

interface IWalletState {
  isSafeApp: boolean
  isProxyDeployed: boolean
  cpkAddress?: string
  cpkBalance?: string
  ownerAddress?: string
  txManager?: TransactionManagerConfig
}

const initialWalletState = {
  isSafeApp: false,
  isProxyDeployed: false,
  cpkAddress: undefined,
  cpkBalance: undefined,
  ownerAddress: undefined,
  txManager: undefined
}

const App = () => {
  const [web3, setWeb3] = React.useState<Web3 | undefined>(undefined)
  const [cpk, setCpk] = useState<CPK | undefined>(undefined)
  const [walletState, updateWalletState] = useCustomReducer<IWalletState>(
    initialWalletState
  )
  const network = 'rinkeby'

  const onWeb3Connect = (provider: any) => {
    if (provider) {
      setWeb3(new Web3(provider))
    }
  }

  const getEthBalance = async (address?: string): Promise<string | undefined> => {
    if (!web3 || !address) return
    const ethBalance = new BigNumber(await web3.eth.getBalance(address))
    const ethDecimals = new BigNumber(10).pow(18)
    return web3 && ethBalance.div(ethDecimals).decimalPlaces(7).toString() + ' ETH'
  }

  const updateCpk = async (): Promise<void> => {
    if (!cpk) return
    updateWalletState({
      isSafeApp: cpk.isSafeApp(),
      isProxyDeployed: await cpk.isProxyDeployed(),
      cpkAddress: cpk.address,
      cpkBalance: await getEthBalance(cpk.address),
      ownerAddress: await cpk.getOwnerAccount()
    })
  }

  const initializeCpk = async (): Promise<void> => {
    if (!web3) return
    const ethLibAdapter = new Web3Adapter({ web3 })
    const newCpk = await CPK.create({ ethLibAdapter })
    setCpk(newCpk)
  }

  useEffect(() => {
    initializeCpk()
  }, [web3])

  useEffect(() => {
    updateCpk()
  }, [cpk])

  return (
    <div className="container">
      <ConnectButton onConnect={onWeb3Connect} networkName={network}/>
      {cpk && (
        <div className="cpk">
          <CpkInfo cpk={cpk} walletState={walletState} updateCpk={updateCpk} />
          <CpkTransactions cpk={cpk} walletState={walletState} />
        </div>
      )}
    </div>
  )
}

export default App
