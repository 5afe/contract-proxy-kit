import React, { useEffect, useState } from 'react'
import CPK from 'contract-proxy-kit'
import styled from 'styled-components'
import { Button, Card, EthHashInfo, Loader, Table, TableHeader, TableRow, Text, TextField, Title } from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'

const Line = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
`

const TitleLine = styled.div`
  margin-right: 10px;
`

const BigLine = styled.div`
  margin: 10px 0;
`

interface SafeModulesProps {
  cpk: CPK
  walletState: WalletState
}

const headers: TableHeader[] = [{
  id: "1",
  label: "Enabled modules"
}]

const SafeModules = ({ cpk, walletState }: SafeModulesProps) => {
  const [module, setModule] = useState<string>("")
  const [txHash, setTxHash] = useState<string>("")
  const [showTxError, setShowTxError] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<TableRow[]>([])

  const getModules = async () => {
    const modules = await cpk.getModules()
    const newRows: TableRow[] = modules.map((module, index) => ({ id: index.toString(), cells: [{ content: module }] }))
    setRows(newRows)
  }

  useEffect(() => {
    getModules()
  }, [])

  const enableModule = async (): Promise<void> => {
    if (!module) return
    setShowTxError(false)
    setTxHash("")
    try  {
      // Remove any type when TransactionResult type is updated
      const txResult: any = await cpk.enableModule(module)      
      const hash = walletState.isSafeApp ? txResult.safeTxHash : txResult.hash
      if (hash) {
        setTxHash(hash)
      }
      setIsLoading(true)
      await new Promise((resolve, reject) =>
        txResult.promiEvent?.then((receipt: any) => resolve(receipt)).catch(reject)
      )
      await getModules()      
    } catch(e) {
      setShowTxError(true)
    }
    setIsLoading(false)
  }

  const disableModule = async (): Promise<void> => {
    if (!module) return
    setShowTxError(false)
    setTxHash("")
    try {
      // Remove any type when TransactionResult type is updated
      const txResult: any = await cpk.disableModule(module)
      const hash = walletState.isSafeApp ? txResult.safeTxHash : txResult.hash
      if (hash) {
        setTxHash(hash)
      }
      setIsLoading(true)
      await new Promise((resolve, reject) =>
        txResult.promiEvent?.then((receipt: any) => resolve(receipt)).catch(reject)
      )
      await getModules()
    } catch(e) {
      setShowTxError(true)
    }
    setIsLoading(false)
  }

  return (
    <>
      <Title size="sm">Safe modules</Title>
      <Line>
        <TitleLine><Text size="xl">Test with this module on Rinkeby:</Text></TitleLine>
        <EthHashInfo hash="0x33A458E072b182152Bb30243f29585a82c45A22b" textSize="xl" showCopyBtn />
      </Line>
      <BigLine>
        <TextField
          id="standard-name"
          label="Module Address"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        />
      </BigLine>
      <Line>
        <Button onClick={enableModule} size="md" color="primary" variant="contained">
          Enable module
        </Button>
      </Line>
      <Line>
        <Button onClick={disableModule} size="md" color="primary" variant="contained">
          Disable module
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
          <EthHashInfo hash={txHash} textSize="xl" shortenHash={8} showCopyBtn />
        </Line>
      )}
      {isLoading ? (
        <BigLine>
          <Card>
            <Loader size="sm" />
          </Card>
        </BigLine>
      ) : (
        <BigLine>
        {rows.length > 0 ? (
          <Table headers={headers} rows={rows} />
        ) : (
          <Card>
            <Text size="xl">No modules enabled</Text>
          </Card>
        )}
        </BigLine>
      )}
    </>
  )
}

export default SafeModules
