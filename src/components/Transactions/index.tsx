import {
  Button,
  Checkbox,
  EthHashInfo,
  Text,
  Title
} from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'
import CPK from 'contract-proxy-kit'
import React, { useState } from 'react'
import styled from 'styled-components'

const Line = styled.div`
  display: flex;
  align-items: center;
  --height: 40px;
  padding: 10px 0;
`

const TitleLine = styled.div`
  margin-right: 10px;
`

interface TransactionsProps {
  cpk: CPK
  walletState: WalletState
  enabledRocksideTxRelay: boolean
  setEnabledRocksideTxRelay: Function
}

const Transactions = ({ cpk, walletState, enabledRocksideTxRelay, setEnabledRocksideTxRelay }: TransactionsProps) => {
  const [txHash, setTxHash] = useState<string>('')
  const [showTxError, setShowTxError] = useState<boolean>(false)

  const makeTransaction = async (): Promise<void> => {
    if (!walletState.ownerAddress) return
    setShowTxError(false)
    setTxHash('')
    const txs = [
      {
        to: walletState.ownerAddress,
        value: `${11e17}`
      }
    ]
    try {
      const txResult = await cpk.execTransactions(txs)
      console.log({txResult})
      console.log(await txResult.promiEvent)
      const hash = walletState.isSafeApp ? txResult.safeTxHash : txResult.hash
      if (hash) {
        setTxHash(hash)
      }
    } catch (e) {
      console.log(e)
      setShowTxError(true)
    }
  }

  return (
    <>
      <Title size="sm">Information</Title>
      <Title size="sm">Configuration</Title>
      <Line>
        <Checkbox
          name="checkboxTxRelay"
          checked={enabledRocksideTxRelay}
          onChange={(_, checked) => setEnabledRocksideTxRelay(checked)}
          label="Rockside transaction relay"
        />
      </Line>
      <br />
      <Title size="sm">Transactions</Title>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            CPK Balance:
          </Text>
        </TitleLine>
        <Text size="xl">{walletState?.cpkBalance}</Text>
      </Line>
      <Line>
        <Button
          onClick={makeTransaction}
          size="md"
          color="primary"
          variant="contained"
        >
          Send transaction
        </Button>
      </Line>
      {showTxError && (
        <Line>
          <Text size="xl" color="error">
            Transaction rejected
          </Text>
        </Line>
      )}
      {txHash && (
        <Line>
          <TitleLine>
            <Text size="xl" as="span" strong>
              {walletState.isSafeApp
                ? 'Safe transaction hash:'
                : 'Transaction hash:'}
            </Text>
          </TitleLine>
          <EthHashInfo
            hash={txHash}
            textSize="xl"
            shortenHash={8}
            showCopyBtn
            showEtherscanBtn
            network="ropsten"
          />
        </Line>
      )}
    </>
  )
}

export default Transactions
