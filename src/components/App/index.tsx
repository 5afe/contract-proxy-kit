import React, { useState, useEffect } from 'react'
import CPK, {
  EthLibAdapter,
  Web3Adapter,
  TransactionManager,
  TransactionManagerConfig,
  CpkTransactionManager,
  SafeRelayTransactionManager,
} from 'contract-proxy-kit'
import Web3 from 'web3'
import ConnectButton from '../ConnectButton'
import useCustomReducer from 'hooks/useCustomReducer'
import './styles.scss'
import CpkTransactions from 'components/CpkTransactions'
import CpkInfo from 'components/CpkInfo'

interface IWalletState {
  address?: string
  ownerAddress?: string
  isSafeApp: boolean
  txManager?: TransactionManagerConfig
}

const initialWalletState = {
  address: undefined,
  ownerAddress: undefined,
  isSafeApp: false,
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

  const updateCpk = async (): Promise<void> => {
    if (!cpk) return
    console.log("updateCpkInfo")
    updateWalletState({
      address: cpk.address,
      ownerAddress: await cpk.getOwnerAccount(),
      isSafeApp: cpk.isSafeApp(),
      txManager: cpk.transactionManager?.config
    })
  }

  const initializeCpk = async (): Promise<void> => {
    if (!web3) return
    console.log('initializeCpk')
    const ethLibAdapter = new Web3Adapter({ web3 })
    const newCpk = await CPK.create({ ethLibAdapter })

    setCpk(newCpk)
  }

  useEffect(() => {
    console.log('useEffect web3', web3)
    initializeCpk()
  }, [web3])

  useEffect(() => {
    console.log('useEffect cpk', cpk)
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
