export async function checkConnectedToSafe(provider: any): Promise<boolean> {
  if (provider == null) return false

  const wc =
    (await provider.getWalletConnector?.()) ||
    (await provider.connection?.getWalletConnector?.()) ||
    provider.wc ||
    provider.connection?.wc

  const peerName = wc?.peerMeta?.name

  if (peerName === 'Safe Multisig WalletConnect' || peerName?.startsWith?.('Gnosis Safe')) {
    return true
  }

  if (provider._providers) {
    return (await Promise.all(provider._providers.map(checkConnectedToSafe))).includes(true)
  }

  return false
}
