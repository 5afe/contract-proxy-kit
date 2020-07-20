import * as React from 'react'
import Web3Connect from 'web3connect'
import './styles.scss'

const {
  default: WalletConnectProvider
} = require("@walletconnect/web3-provider")

type ConnectButtonProps = {
  onConnect: Function
}

const ConnectButton = ({ onConnect }: ConnectButtonProps) => (
  <div className="connectButton">
    <Web3Connect.Button
      network="rinkeby"
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
