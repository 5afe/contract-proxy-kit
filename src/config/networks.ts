import { Address } from '../utils/basicTypes'

interface ProxySearchParams {
  proxyFactoryAddress: Address
  initialImplAddress: Address
}

export interface NetworkConfigEntry {
  proxySearchParams?: ProxySearchParams[]
  proxyFactoryAddress?: Address
  masterCopyAddress?: Address
  multiSendAddress: Address
  fallbackHandlerAddress: Address
}

export interface NetworksConfig {
  [id: string]: NetworkConfigEntry
}

export interface NormalizedNetworkConfigEntry {
  proxySearchParams: ProxySearchParams[]
  masterCopyAddress: Address
  multiSendAddress: Address
  fallbackHandlerAddress: Address
}

export interface NormalizedNetworksConfig {
  [id: string]: NormalizedNetworkConfigEntry
}

const defaultMasterCopyAddress = '0x6851D6fDFAfD08c0295C392436245E5bc78B0185'

export const defaultNetworks: NormalizedNetworksConfig = {
  // mainnet
  1: {
    // For proxy search params, the first element belongs to latest release.
    // Do not alter this order. New releases go first.
    proxySearchParams: [
      {
        proxyFactoryAddress: '0x0fB4340432e56c014fa96286de17222822a9281b',
        initialImplAddress: defaultMasterCopyAddress
      },
      {
        proxyFactoryAddress: '0x0fB4340432e56c014fa96286de17222822a9281b',
        initialImplAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F'
      },
    ],
    masterCopyAddress: defaultMasterCopyAddress,
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // rinkeby
  4: {
    proxySearchParams: [
      {
        proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
        initialImplAddress: defaultMasterCopyAddress
      },
      {
        proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
        initialImplAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F'
      },
    ],
    masterCopyAddress: defaultMasterCopyAddress,
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // goerli
  5: {
    proxySearchParams: [
      {
        proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
        initialImplAddress: defaultMasterCopyAddress
      },
      {
        proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
        initialImplAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F'
      },
    ],
    masterCopyAddress: defaultMasterCopyAddress,
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // kovan
  42: {
    proxySearchParams: [
      {
        proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
        initialImplAddress: defaultMasterCopyAddress
      },
      {
        proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
        initialImplAddress: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F'
      },
    ],
    masterCopyAddress: defaultMasterCopyAddress,
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  }
}

export function normalizeNetworksConfig(
  defaultNetworks: NormalizedNetworksConfig,
  networks?: NetworksConfig
): NormalizedNetworksConfig {
  if (!networks) {
    return defaultNetworks
  }
  const normalizedNetworks: NormalizedNetworksConfig = {}
  for (const networkId of Object.keys(networks)) {
    const currentNetwork = networks[networkId]
    let searchParams: ProxySearchParams[] = []
    if (currentNetwork.proxySearchParams) {
      searchParams = currentNetwork.proxySearchParams
    } else if (currentNetwork.proxyFactoryAddress && currentNetwork.masterCopyAddress) {
      searchParams = [
        {
          proxyFactoryAddress: currentNetwork.proxyFactoryAddress,
          initialImplAddress: currentNetwork.masterCopyAddress,
        }
      ]
    }
    if (searchParams.length === 0) {
      throw new Error(
        'Properties "proxySearchParams" or "proxyFactoryAddress" and "masterCopyAddress" are missing in CPK network configuration'
      )
    }
    normalizedNetworks[networkId] = {
      proxySearchParams: searchParams,
      masterCopyAddress: currentNetwork.masterCopyAddress || defaultMasterCopyAddress,
      multiSendAddress: currentNetwork.multiSendAddress,
      fallbackHandlerAddress: currentNetwork.fallbackHandlerAddress
    }
  }
  return {
    ...defaultNetworks,
    ...normalizedNetworks
  }
}
