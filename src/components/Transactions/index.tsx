import React, { useState } from 'react'
import CPK from 'contract-proxy-kit'
import styled from 'styled-components'
import { Button, EthHashInfo, Text, Title } from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'

const Line = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
`

const TitleLine = styled.div`
  margin-right: 10px;
`

interface TransactionsProps {
  cpk: CPK
  walletState: WalletState
}

const Transactions = ({
  cpk,
  walletState,
}: TransactionsProps) => {
  const [txHash, setTxHash] = useState<string>("")
  const [showTxError, setShowTxError] = useState<boolean>(false)

  const makeTransaction = async (): Promise<void> => {
    if (!walletState.ownerAddress) return
    setShowTxError(false)
    const txs = [{
      to: walletState.ownerAddress,
    }]
    try {
      const txResult = await cpk.execTransactions(txs)
      const hash = walletState.isSafeApp ? txResult.safeTxHash : txResult.hash
      setTxHash(hash ?? "")
    } catch(e) {
      setShowTxError(true)
    }
  }

  return (
    <>
      <Title size="sm">Transactions</Title>
      <Line>
        <Button onClick={makeTransaction} size="md" color="primary" variant="contained">
          Send empty tx to the CPK owner
        </Button>
      </Line>
      {showTxError && (
        <Line>
          <Text size="xl" color="error">Transaction rejected</Text>
        </Line>
      )}
      {txHash && (
        <Line>
          <TitleLine><Text size="xl" as="span" strong>{walletState.isSafeApp ? 'Safe transaction hash:' : 'Transaction hash:'}</Text></TitleLine>
          <EthHashInfo hash={txHash} textSize="xl" shortenHash={8} showCopyBtn/>
        </Line>
      )}
    </>
  )
}

export default Transactions
