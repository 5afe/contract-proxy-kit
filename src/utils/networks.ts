type Networks = {
  [key: string]: number
}

export const getNetworkIdFromName = (networkName?: string): number | undefined => {
  if (!networkName) return
  const networks: Networks = {
    mainnet: 1,
    morden: 2,
    ropsten: 3,
    rinkeby: 4,
    goerli: 5,
    kovan: 42,
    xdai: 100,
    energy_web_chain: 246,
    volta: 73799
  }
  return networks[networkName]
}
