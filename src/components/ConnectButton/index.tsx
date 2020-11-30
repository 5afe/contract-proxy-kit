import * as React from 'react'
import Web3Connect from 'web3connect'
import styled from 'styled-components'

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
}

const ConnectButton = ({ onConnect }: ConnectButtonProps) => (
  <Web3ConnectButton>
    <Web3Connect.Button
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
