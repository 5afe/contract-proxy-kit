import {
  Button,
  Card,
  EthHashInfo,
  Loader,
  Table,
  TableHeader,
  TableRow,
  Text,
  TextField,
  Title
} from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'
import CPK, { TransactionResult } from 'contract-proxy-kit'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import { getNetworkNameFromId } from 'utils/networks'

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

const headers: TableHeader[] = [
  {
    id: '1',
    label: 'Enabled modules'
  }
]

const SafeModules = ({ cpk, walletState }: SafeModulesProps) => {
  const [module, setModule] = useState<string>('')
  const [txHash, setTxHash] = useState<string | null | undefined>()
  const [safeTxHash, setSafeTxHash] = useState<string | undefined>()
  const [showTxError, setShowTxError] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [rows, setRows] = useState<TableRow[]>([])

  const getModules = useCallback(async () => {
    try {
      const modules = await cpk.getModules()
      const newRows: TableRow[] = modules.map((module, index) => ({
        id: index.toString(),
        cells: [{ content: module }]
      }))
      setRows(newRows)
    } catch (error) {
      console.error(error)
    }
  }, [cpk])

  useEffect(() => {
    getModules()
  }, [getModules])

  const enableModule = async (): Promise<void> => {
    if (!module) return
    let txResult
    setShowTxError(false)
    setTxHash('')
    
    try {
      txResult = await cpk.enableModule(module)
    } catch (e) {
      console.error(e)
      setShowTxError(true)
    }

    await handleTxResult(txResult)
  }

  const disableModule = async (): Promise<void> => {
    if (!module) return
    let txResult
    
    setShowTxError(false)
    setTxHash('')

    try {
      txResult = await cpk.disableModule(module)
    } catch (e) {
      console.error(e)
      setShowTxError(true)
    }

    await handleTxResult(txResult)
  }

  const handleTxResult = async (txResult: TransactionResult) => {
    let txServiceModel

    if (txResult.safeTxHash) {
      setSafeTxHash(txResult.safeTxHash)
      txServiceModel = await cpk.safeAppsSdkConnector?.getBySafeTxHash(
        txResult.safeTxHash
      )
    }
    if (txResult.hash || txServiceModel) {
      setTxHash(txResult.hash || txServiceModel?.transactionHash)
    }

    setIsLoading(true)
    await new Promise((resolve, reject) =>
      txResult.promiEvent
        ?.then((receipt: any) => resolve(receipt))
        .catch(reject)
    )
    await getModules()
    setIsLoading(false)
  }

  return (
    <>
      <Title size="sm">Safe modules</Title>
      <Line>
        <TitleLine>
          <Text size="xl">Test with this module on Rinkeby:</Text>
        </TitleLine>
        <EthHashInfo
          hash="0x33A458E072b182152Bb30243f29585a82c45A22b"
          textSize="xl"
          showEtherscanBtn
          showCopyBtn
          network={getNetworkNameFromId(walletState?.networkId)}
        />
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
        <Button
          onClick={enableModule}
          size="md"
          color="primary"
          variant="contained"
        >
          Enable module
        </Button>
      </Line>
      <Line>
        <Button
          onClick={disableModule}
          size="md"
          color="primary"
          variant="contained"
        >
          Disable module
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
              Transaction hash:
            </Text>
          </TitleLine>
          <EthHashInfo
            hash={txHash}
            textSize="xl"
            shortenHash={8}
            showEtherscanBtn
            showCopyBtn
            network={getNetworkNameFromId(walletState?.networkId)}
          />
        </Line>
      )}
      {safeTxHash && (
        <Line>
          <TitleLine>
            <Text size="xl" as="span" strong>
              Safe transaction hash:
            </Text>
          </TitleLine>
          <EthHashInfo
            hash={safeTxHash}
            textSize="xl"
            shortenHash={8}
            showCopyBtn
            network={getNetworkNameFromId(walletState?.networkId)}
          />
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
