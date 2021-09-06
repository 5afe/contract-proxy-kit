export enum NetworkNames {
  MAINNET = 'MAINNET',
  MORDEN = 'MORDEN',
  ROPSTEN = 'ROPSTEN',
  RINKEBY = 'RINKEBY',
  GOERLI = 'GOERLI',
  KOVAN = 'KOVAN',
  XDAI = 'XDAI',
  ENERGY_WEB_CHAIN = 'ENERGY_WEB_CHAIN',
  VOLTA = 'VOLTA'
}

type Networks = {
  [key in NetworkNames]: number
}

export const getNetworkIdFromName = (networkName?: string): number | undefined => {
  if (!networkName) return
  const networks: Networks = {
    MAINNET: 1,
    MORDEN: 2,
    ROPSTEN: 3,
    RINKEBY: 4,
    GOERLI: 5,
    KOVAN: 42,
    XDAI: 100,
    ENERGY_WEB_CHAIN: 246,
    VOLTA: 73799
  }
  return networks[networkName.toUpperCase() as NetworkNames]
}
