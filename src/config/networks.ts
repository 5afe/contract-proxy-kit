import { Address } from '../utils/basicTypes'

interface MasterCopyAddressVersion {
  version: string
  address: Address
}

export interface NetworkConfigEntry {
  masterCopyAddress: Address
  masterCopyAddressVersions?: Array<MasterCopyAddressVersion>
  proxyFactoryAddress: Address
  multiSendAddress: Address
  fallbackHandlerAddress: Address
}

export interface NetworksConfig {
  [id: string]: NetworkConfigEntry
}

export interface NormalizedNetworkConfigEntry {
  masterCopyAddressVersions: MasterCopyAddressVersion[]
  proxyFactoryAddress: Address
  multiSendAddress: Address
  fallbackHandlerAddress: Address
}

export interface NormalizedNetworksConfig {
  [id: string]: NormalizedNetworkConfigEntry
}

// First element belongs to latest release. Do not alter this order. New releases go first.
const masterCopyAddressVersions: MasterCopyAddressVersion[] = [
  {
    version: '1.2.0',
    address: '0x6851D6fDFAfD08c0295C392436245E5bc78B0185'
  },
  {
    version: '1.1.1',
    address: '0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F'
  }
]

export const defaultNetworks: NormalizedNetworksConfig = {
  // mainnet
  1: {
    masterCopyAddressVersions,
    proxyFactoryAddress: '0x0fB4340432e56c014fa96286de17222822a9281b',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // rinkeby
  4: {
    masterCopyAddressVersions,
    proxyFactoryAddress: '0x336c19296d3989e9e0c2561ef21c964068657c38',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // goerli
  5: {
    masterCopyAddressVersions,
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
    multiSendAddress: '0x8D29bE29923b68abfDD21e541b9374737B49cdAD',
    fallbackHandlerAddress: '0x40A930851BD2e590Bd5A5C981b436de25742E980'
  },
  // kovan
  42: {
    masterCopyAddressVersions,
    proxyFactoryAddress: '0xfC7577774887aAE7bAcdf0Fc8ce041DA0b3200f7',
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
    let mcVersions: MasterCopyAddressVersion[] = []
    if (networks[networkId].masterCopyAddress) {
      mcVersions = [
        {
          version: masterCopyAddressVersions[0].version,
          address: networks[networkId].masterCopyAddress
        }
      ]
    }
    normalizedNetworks[networkId] = {
      masterCopyAddressVersions: mcVersions,
      proxyFactoryAddress: networks[networkId].proxyFactoryAddress,
      multiSendAddress: networks[networkId].multiSendAddress,
      fallbackHandlerAddress: networks[networkId].fallbackHandlerAddress
    }
  }
  return {
    ...defaultNetworks,
    ...normalizedNetworks
  }
}
