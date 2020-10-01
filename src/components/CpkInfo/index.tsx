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

    const txManager: TransactionManager = (relayEndpoint)
      ? new SafeRelayTransactionManager({ url: relayEndpoint })
      : new CpkTransactionManager()

    cpk.setTransactionManager(txManager)
    updateCpk()
  }

  useEffect(() => {
    if (!isRelayChecked) {
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
        <div className="dataTitle">Running as a:</div>
        <div className="dataValue">{walletState?.isSafeApp ? "Safe App" : "Standalone App"}</div>
      </div>
      <div className="dataLine">
        <div className="dataTitle">State of the Proxy:</div>
        <div className="dataValue">{walletState?.isProxyDeployed ? "Deployed" : "Not deployed"}</div>
      </div>
      <div className="dataLine">
        <div className="dataTitle">CPK address:</div>
        <div className="dataValue">{walletState?.cpkAddress}</div>
      </div>
      <div className="dataLine">
        <div className="dataTitle">CPK Balance:</div>
        <div className="dataValue">{walletState?.cpkBalance}</div>
      </div>
      <div className="dataLine">
        <div className="dataTitle">Owner address:</div>
        <div className="dataValue">{walletState?.ownerAddress}</div>
      </div>
      <div className="dataLine">
        <div className="dataTitle">Relay service:</div>
        <div className="dataValue">{walletState?.txManager?.url && (walletState?.txManager?.url)}</div>
      </div>
      <div className="dataLine">
        <div className="dataTitle">
          <input type="checkbox" onChange={(e) => handleRelayChecked(e.target.checked)}/>
          {' '}Use relay service
        </div>
      </div>
      <div className="dataLine">
        {isRelayChecked && (
          <div className="relayForm">
            <input
              type="text"
              placeholder="https://safe-relay.rinkeby.gnosis.io"
              onChange={(e) => setRelayEndpoint(e.target.value)}
            />
            <button disabled={!relayEndpoint} onClick={() => setRelay()}>
              Set Safe relay service URL
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CpkInfo
