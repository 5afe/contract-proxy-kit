import React, { useState } from 'react'
import CPK from 'contract-proxy-kit'
import './styles.scss'

interface CpkTransactionsProps {
  cpk: CPK
  walletState: any
}

const CpkTransactions = ({
  cpk,
  walletState,
}: CpkTransactionsProps) => {
  const [lastTxHash, setLastTxHash] = useState<string | undefined>(undefined)
  const [showTxError, setShowTxError] = useState<boolean>(false)

  // Do not use this module on production
  const dailyLimitModule = '0x33A458E072b182152Bb30243f29585a82c45A22b'

  const makeTransaction = async (): Promise<void> => {
    if (!walletState.ownerAddress) return
    setShowTxError(false)
    const txs = [
      {
        to: walletState.ownerAddress,
      }
    ]
    try {
      const txResult = await cpk.execTransactions(txs)
      const hash = cpk.isSafeApp() ? txResult.safeTxHash : txResult.hash
      setLastTxHash(hash)
    } catch(e) {
      setShowTxError(true)
    }
  }

  const getModules = async (): Promise<void> => {
    console.log('getmodules')
    const modules = await cpk.getModules()
    console.log(modules)
  }

  const enableDailyLimitModule = async (): Promise<void> => {
    console.log('enableDailyLimitModule')
    const txResult = await cpk.enableModule(dailyLimitModule)
    const hash = cpk.isSafeApp() ? txResult.safeTxHash : txResult.hash
    setLastTxHash(hash)
  }

  const disableDailyLimitModule = async (): Promise<void> => {
    console.log('disableDailyLimitModule')
    const txResult = await cpk.disableModule(dailyLimitModule)
    const hash = cpk.isSafeApp() ? txResult.safeTxHash : txResult.hash
    setLastTxHash(hash)
  }

  return (
    <div className="cpkTransactions">
      <div className="dataLine">
        <button onClick={makeTransaction}>Send empty tx to the CPK owner</button>
        <br/><br/><br/>
        <button onClick={enableDailyLimitModule}>Enable daily limit module</button>
        <br/><br/>
        <button onClick={disableDailyLimitModule}>Disable daily limit module</button>
        <br/><br/><br/>
        <button onClick={getModules}>Get modules</button>
        <br/><br/><br/>
      </div>
      {showTxError && (
        <div className="dataLine errorMessage">Transaction rejected</div>
      )}
      <div className="dataLine">
        <span className="dataTitle">Last transaction hash:</span>
      </div>
      <div className="dataLine">{lastTxHash}</div>
    </div>
  )
}

export default CpkTransactions
