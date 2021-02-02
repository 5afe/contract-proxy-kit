import {
  EthHashInfo,
  Text,
  TextField,
  Title
} from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'
import React from 'react'
import styled from 'styled-components'
import { formatBalance } from 'utils/balances'
import { getNetworkNameFromId } from 'utils/networks'

const Line = styled.div`
  display: flex;
  align-items: center;
  min-height: 45px;
`

const TitleLine = styled.div`
  margin-right: 10px;
`

const STextField = styled(TextField)`
  width: 600px !important;
`

interface CpkInfoProps {
  walletState: WalletState
  saltNonce: string
  setSaltNonce: Function
}

const CpkInfo = ({ walletState, saltNonce, setSaltNonce }: CpkInfoProps) => {
  return (
    <>
      <Title size="sm">Information</Title>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            Network:
          </Text>
        </TitleLine>
        <Text size="xl">
          {walletState?.networkId &&
            getNetworkNameFromId(walletState?.networkId)}
        </Text>
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            Running as a:
          </Text>
        </TitleLine>
        <Text size="xl">
          {walletState?.isSafeApp ? 'Safe App' : 'Standalone App'}
        </Text>
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            Connected to:
          </Text>
        </TitleLine>
        <Text size="xl">
          {walletState?.isConnectedToSafe ? 'Safe account' : 'EOA'}
        </Text>
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            State of the Proxy:
          </Text>
        </TitleLine>
        <Text size="xl">
          {walletState?.isProxyDeployed
            ? `Deployed ${
                walletState?.contractVersion &&
                `(v${walletState?.contractVersion})`
              }`
            : 'Not deployed'}
        </Text>
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            Owner address:
          </Text>
        </TitleLine>
        {walletState?.ownerAddress && (
          <EthHashInfo
            hash={walletState?.ownerAddress}
            showIdenticon
            showCopyBtn
            showEtherscanBtn
            textSize="xl"
            shortenHash={4}
          />
        )}
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            CPK address:
          </Text>
        </TitleLine>
        {walletState?.cpkAddress && (
          <EthHashInfo
            hash={walletState?.cpkAddress}
            showIdenticon
            showCopyBtn
            showEtherscanBtn
            textSize="xl"
            shortenHash={4}
          />
        )}
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            CPK Balance:
          </Text>
        </TitleLine>
        <Text size="xl">{formatBalance(walletState?.cpkBalance)}</Text>
      </Line>
      <Line>
        <TitleLine>
          <Text size="xl" strong>
            CPK salt nonce:
          </Text>
        </TitleLine>
        {walletState?.saltNonce && (
          <EthHashInfo
            hash={walletState?.saltNonce}
            showCopyBtn
            textSize="xl"
            shortenHash={4}
          />
        )}
      </Line>
      <Title size="sm">Configuration</Title>
      <Line>
        <STextField
          id="saltnonce"
          label="Custom CPK salt nonce"
          value={saltNonce}
          onChange={(e) => setSaltNonce(e.target.value)}
        />
      </Line>
    </>
  )
}

export default CpkInfo
