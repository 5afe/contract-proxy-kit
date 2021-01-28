import * as React from 'react'
import styled from 'styled-components'
import Web3Connect from 'web3connect'

const Web3ConnectButton = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  margin-bottom: 10px;
  & > div {
    padding: 0;
  }
  .web3connect-connect-button {
    outline: none;
    background: #008c73;
    border: 1px solid #008c73;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    transform: none;
    font-weight: normal;
    font-size: 14px;
    box-shadow: none;
  }
  .web3connect-connect-button:hover {
    background: #005546;
    box-shadow: none;
    transform: none;
  }
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
