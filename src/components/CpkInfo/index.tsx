import React, { useState, useEffect } from 'react'
import {
  TransactionManager,
  SafeRelayTransactionManager,
  CpkTransactionManager
} from 'contract-proxy-kit'
import './styles.scss'

interface CpkInfoProps {
  cpk: any
  walletState: any
  updateCpk: any
}

const CpkInfo = ({
  cpk,
  walletState,
  updateCpk,
}: CpkInfoProps) => {
  const [isRelayChecked, setIsRelayChecked] = useState<boolean>(false)
  const [relayEndpoint, setRelayEndpoint] = useState<string | undefined>(undefined)

  const setRelay = (): void => {
    if (!cpk) return
    if (walletState.txManager?.url === relayEndpoint) return

    console.log(`setRelay (endpoint: ${relayEndpoint})`)

    const txManager: TransactionManager = (relayEndpoint)
      ? new SafeRelayTransactionManager({ url: relayEndpoint })
      : new CpkTransactionManager()

    cpk.setTransactionManager(txManager)
    updateCpk()
  }

  useEffect(() => {
    console.log('isRelayChecked', isRelayChecked)
    if (!isRelayChecked) {
      console.log('useEffect isRelayChecked', isRelayChecked)
      setRelay()
    }
  }, [isRelayChecked])

  const handleRelayChecked = (isChecked: boolean): void => {
    setRelayEndpoint(undefined)
    setIsRelayChecked(isChecked)
  }

  return (
    <div className="cpkData">
      <div className="dataLine">
        <span className="dataTitle">Running as a:</span>
        {walletState?.isSafeApp ? "Safe App" : "standalone app"}
      </div>
      <div className="dataLine">
        <span className="dataTitle">Owner address:</span>
        {walletState?.ownerAddress}
      </div>
      <div className="dataLine">
        <span className="dataTitle">CPK address:</span>
        {walletState?.address}
      </div>
      <div className="dataLine">
        <div>
          <span className="dataTitle">Transaction manager:</span>
          {walletState?.txManager?.name}
        </div>
        <div className="txManagerDescription">
          {walletState?.txManager?.name === 'CpkTransactionManager' && (
            'Transactions are submitted using the connected Ethereum provider'
          )}
          {walletState?.txManager?.name === 'SafeRelayTransactionManager' && (
            'Transactions are submitted using the Safe Relay Service selected'
          )}
          {walletState?.txManager?.name === 'SafeAppsSdkTransactionManager' && (
            'Transactions are submitted using the Safe web interface'
          )}
        </div>
      </div>
      <div className="dataLine">
        <span className="dataTitle">Relay service:</span>
        {walletState?.txManager?.url && (walletState?.txManager?.url)}
      </div>
      <div className="dataLine">
        <span className="dataTitle">
          <input type="checkbox" onChange={(e) => handleRelayChecked(e.target.checked)}/>
          {' '}Use relay service
        </span>
      </div>
      <div className="dataLine">
        {isRelayChecked && (
          <>
            <input
              type="text"
              placeholder="https://safe-relay.rinkeby.gnosis.io/"
              onChange={(e) => setRelayEndpoint(e.target.value)}
            />
            <button disabled={!relayEndpoint} onClick={() => setRelay()}>
              Set Relay service domain
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default CpkInfo
