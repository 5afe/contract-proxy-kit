import { Address } from '../utils/basicTypes'

export interface NetworkConfigEntry {
  masterCopyAddress: Address
  proxyFactoryAddress: Address
  multiSendAddress: Address
  fallbackHandlerAddress: Address
}

export interface NetworksConfig {
  [id: string]: NetworkConfigEntry
}

// First element belongs to latest release. Do not alter this order. New releases go first.
export const masterCopyAddressVersions = [
  {
    version: '1.2.0',
    address: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185'
  },
  {
    version: '1.1.1',
    address: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F'
  }
]

export const defaultNetworks: NetworksConfig = {
  // mainnet
  1: {
    masterCopyAddress: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185',
    proxyFactoryAddress: '0x0fB4340432e56c014fa96286de17222822a9281b',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0xd5D82B6aDDc9027B22dCA772Aa68D5d74cdBdF44'
  },
  // rinkeby
  4: {
    masterCopyAddress: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185',
    proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0xd5D82B6aDDc9027B22dCA772Aa68D5d74cdBdF44'
  },
  // goerli
  5: {
    masterCopyAddress: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0xd5D82B6aDDc9027B22dCA772Aa68D5d74cdBdF44'
  },
  // kovan
  42: {
    masterCopyAddress: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0xd5D82B6aDDc9027B22dCA772Aa68D5d74cdBdF44'
  },
  // xdai
  100: {
    masterCopyAddress: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0xd5D82B6aDDc9027B22dCA772Aa68D5d74cdBdF44'
  }
}
