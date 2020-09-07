import * as React from 'react'
import Web3Connect from 'web3connect'
import './styles.scss'

const {
  default: WalletConnectProvider
} = require("@walletconnect/web3-provider")

type ConnectButtonProps = {
  onConnect: Function
  networkName: string
}

const ConnectButton = ({ onConnect, networkName }: ConnectButtonProps) => (
  <div className="connectButton">
    <Web3Connect.Button
      network={networkName}
      providerOptions={{
        walletconnect: {
          package: WalletConnectProvider,
          options: {
            infuraId: "b42c928da8fd4c1f90374b18aa9ac6ba"
          }
        }
      }}
      onConnect={onConnect}
      onClose={() => {}}
    />
  </div>
)

export default ConnectButton
