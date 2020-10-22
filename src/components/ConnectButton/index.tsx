import * as React from 'react'
import Web3Connect from 'web3connect'
import styled from 'styled-components'
import './styles.scss'

const Web3ConnectButton = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
`

const {
  default: WalletConnectProvider
} = require('@walletconnect/web3-provider')

type ConnectButtonProps = {
  onConnect: Function
  networkName: string
}

const ConnectButton = ({ onConnect, networkName }: ConnectButtonProps) => (
  <Web3ConnectButton>
    <Web3Connect.Button
      network={networkName}
      providerOptions={{
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            infuraId: 'b42c928da8fd4c1f90374b18aa9ac6ba'
          }
        }
      }}
      onConnect={onConnect}
      onClose={() => {}}
    />
  </Web3ConnectButton>
)

export default ConnectButton
