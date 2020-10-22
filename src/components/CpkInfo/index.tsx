import React from 'react'
import styled from 'styled-components'
import { EthHashInfo, Text, Title } from '@gnosis.pm/safe-react-components'
import { WalletState } from 'components/App'

const Line = styled.div`
  display: flex;
  align-items: center;
  height: 40px;
`

const TitleLine = styled.div`
  margin-right: 10px;
`

interface CpkInfoProps {
  walletState: WalletState
}

const CpkInfo = ({ walletState }: CpkInfoProps) => {
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
            CPK Balance:
          </Text>
        </TitleLine>
        <Text size="xl">{walletState?.cpkBalance}</Text>
      </Line>
    </>
  )
}

export default CpkInfo
