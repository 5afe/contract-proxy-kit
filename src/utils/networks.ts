type Networks = {
  [key: number]: string
}

export const getNetworkNameFromId = (networkId?: number): string | undefined => {
  if (!networkId) return
  const networks: Networks = {
    1: 'Mainnet',
    2: 'Morden',
    3: 'Ropsten',
    4: 'Rinkeby',
    5: 'Goerli',
    42: 'Kovan',
    100: 'xDai',
    246: 'Energy Web Chain',
    73799: 'Volta (Energy Web Chain)'
  }
  return networks[networkId]
}
