interface NetworkConfigEntry {
  masterCopyAddress: string
  proxyFactoryAddress: string
  multiSendAddress: string
  fallbackHandlerAddress: string
}

export interface NetworksConfig {
  [id: string]: NetworkConfigEntry
}

export const defaultNetworks: NetworksConfig = {
  // mainnet
  1: {
    masterCopyAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F',
    proxyFactoryAddress: '0x0fB4340432e56c014fa96286de17222822a9281b',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // rinkeby
  4: {
    masterCopyAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F',
    proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // goerli
  5: {
    masterCopyAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // kovan
  42: {
    masterCopyAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F',
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  }
}
