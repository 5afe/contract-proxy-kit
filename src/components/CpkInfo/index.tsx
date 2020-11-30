import {
  EthHashInfo,
  Text,
  TextField,
  Title
} from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'
import React from 'react'
import styled from 'styled-components'

const Line = styled.div`
  display: flex;
  align-items: center;
  min-height: 45px;
`

const TitleLine = styled.div`
  margin-right: 10px;
`

interface CpkInfoProps {
  walletState: WalletState
  //saltNonce: string
  //setSaltNonce: Function
}

const CpkInfo = ({ walletState /*, saltNonce, setSaltNonce*/ }: CpkInfoProps) => {
  return (
    <>
      
      <Title size="sm">Information</Title>
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
            State of the Proxy:
          </Text>
        </TitleLine>
        <Text size="xl">
          {walletState?.isProxyDeployed ? 'Deployed' : 'Not deployed'}
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
            shortenHash={4}
          />
        )}
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
            shortenHash={4}
          />
        )}
      </Line>
      {/*
      <Title size="sm">Configuration</Title>
      <Line>
        <TextField
          id="saltnonce"
          label="Custom CPK salt nonce"
          value={saltNonce}
          onChange={(e) => setSaltNonce(e.target.value)}
        />
      </Line>
      */}
    </>
  )
}

export default CpkInfo
