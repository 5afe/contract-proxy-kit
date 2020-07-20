import React, { useState } from 'react'

interface CpkTransactionsProps {
  cpk: any
  walletState: any
}

const CpkTransactions = ({
  cpk,
  walletState,
}: CpkTransactionsProps) => {
  const [lastTxHash, setLastTxHash] = useState<string | undefined>(undefined)
  const [showTxError, setShowTxError] = useState<boolean>(false)

  const makeTransaction = async (): Promise<void> => {
    if (!walletState.ownerAddress) return
    setShowTxError(false)

    const txs = [
      {
        //operation: CPK.Call,
        to: walletState.ownerAddress,
        //value: 0,
        //data: '0x'
      }
    ]

    try {
      const txResult = await cpk.execTransactions(txs)
      setLastTxHash(txResult.hash)
    } catch(e) {
      setShowTxError(true)
    }
  }

  return (
    <div className="cpkTransactions">
      <div className="dataLine">
        <button onClick={makeTransaction}>Send empty tx to the CPK owner</button>
      </div>
      {showTxError && (
        <div className="dataLine errorMessage">
          An error occurred with this transaction. Check the logs in the dev console for more info.
        </div>
      )}
      <div className="dataLine">
        <span className="dataTitle">Last transaction hash:</span>
      </div>
      <div className="dataLine">
        {lastTxHash}
      </div>
    </div>
  )
}

export default CpkTransactions
