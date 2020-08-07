import React, { useState, useEffect } from 'react'
import CPK, { Web3Adapter, TransactionManagerConfig } from 'contract-proxy-kit'
import Web3 from 'web3'
import ConnectButton from '../ConnectButton'
import useCustomReducer from 'hooks/useCustomReducer'
import './styles.scss'
import CpkTransactions from 'components/CpkTransactions'
import CpkInfo from 'components/CpkInfo'
import { BigNumber } from 'bignumber.js'

interface IWalletState {
  isSafeApp: boolean
  cpkAddress?: string
  cpkBalance?: string
  ownerAddress?: string
  ownerBalance?: string
  txManager?: TransactionManagerConfig
}

const initialWalletState = {
  isSafeApp: false,
  cpkAddress: undefined,
  cpkBalance: undefined,
  ownerAddress: undefined,
  ownerBalance: undefined,
  txManager: undefined
}

const App = () => {
  const [web3, setWeb3] = React.useState<Web3 | undefined>(undefined)
  const [cpk, setCpk] = useState<CPK | undefined>(undefined)
  const [walletState, updateWalletState] = useCustomReducer<IWalletState>(
    initialWalletState
  )

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
    const cpkBalance = await getEthBalance(cpk.address);
    const ownerAddress = await cpk.getOwnerAccount()
    const ownerBalance = cpk.isSafeApp()
      ? cpk.safeAppInfo?.ethBalance + ' ETH'
      : await getEthBalance(ownerAddress);

    updateWalletState({
      isSafeApp: cpk.isSafeApp(),
      cpkAddress: cpk.address,
      cpkBalance,
      ownerAddress,
      ownerBalance,
      txManager: cpk.transactionManager?.config
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
      <ConnectButton onConnect={onWeb3Connect} />
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
