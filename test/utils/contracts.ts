const TruffleContract = require('@truffle/contract')
import Web3Maj1Min3 from 'web3-1-3'
import CPKFactoryJson from '../../build/contracts/CPKFactory.json'
import GnosisSafeJson from '../../build/contracts/GnosisSafe.json'
import MultiSendJson from '../../build/contracts/MultiSend.json'
import DefaultCallbackHandlerJson from '../../build/contracts/DefaultCallbackHandler.json'
import GnosisSafeProxyFactoryJson from '../../build/contracts/GnosisSafeProxyFactory.json'
import MultistepJson from '../../build/contracts/Multistep.json'
import ERC20MintableJson from '../../build/contracts/ERC20Mintable.json'
import ConditionalTokensJson from '../../build/contracts/ConditionalTokens.json'
import DailyLimitModuleJson from '../../build/contracts/DailyLimitModule.json'
import { Address } from '../../src/utils/basicTypes'

let CPKFactory: any
let GnosisSafe: any
let GnosisSafeProxyFactory: any
let MultiSend: any
let DefaultCallbackHandler: any
let MultiStep: any
let ERC20Mintable: any
let ConditionalTokens: any
let DailyLimitModule: any

let cpkFactory: any
let gnosisSafe: any
let gnosisSafeProxyFactory: any
let multiSend: any
let defaultCallbackHandler: any
let multiStep: any
let erc20: any
let conditionalTokens: any
let dailyLimitModule: any

export interface TestContractInstances {
  cpkFactory: any
  gnosisSafe: any
  gnosisSafeProxyFactory: any
  multiSend: any
  defaultCallbackHandler: any
  multiStep: any
  erc20: any
  conditionalTokens: any
  dailyLimitModule: any
}

export interface TestContracts {
  CPKFactory: any
  GnosisSafe: any
  GnosisSafeProxyFactory: any
  MultiSend: any
  DefaultCallbackHandler: any
  MultiStep: any
  ERC20Mintable: any
  ConditionalTokens: any
  DailyLimitModule: any
}

export const initializeContracts = async (safeOwner: Address): Promise<void> => {
  const provider = new Web3Maj1Min3.providers.HttpProvider('http://localhost:8545')

  CPKFactory = TruffleContract(CPKFactoryJson)
  CPKFactory.setProvider(provider)
  CPKFactory.defaults({ from: safeOwner })
  cpkFactory = await CPKFactory.deployed()

  GnosisSafe = TruffleContract(GnosisSafeJson)
  GnosisSafe.setProvider(provider)
  GnosisSafe.defaults({ from: safeOwner })
  gnosisSafe = await GnosisSafe.deployed()

  GnosisSafeProxyFactory = TruffleContract(GnosisSafeProxyFactoryJson)
  GnosisSafeProxyFactory.setProvider(provider)
  GnosisSafeProxyFactory.defaults({ from: safeOwner })
  gnosisSafeProxyFactory = await GnosisSafeProxyFactory.deployed()

  MultiSend = TruffleContract(MultiSendJson)
  MultiSend.setProvider(provider)
  MultiSend.defaults({ from: safeOwner })
  multiSend = await MultiSend.deployed()

  DefaultCallbackHandler = TruffleContract(DefaultCallbackHandlerJson)
  DefaultCallbackHandler.setProvider(provider)
  DefaultCallbackHandler.defaults({ from: safeOwner })
  defaultCallbackHandler = await DefaultCallbackHandler.deployed()

  MultiStep = TruffleContract(MultistepJson)
  MultiStep.setProvider(provider)
  MultiStep.defaults({ from: safeOwner })
  multiStep = await MultiStep.deployed()

  ERC20Mintable = TruffleContract(ERC20MintableJson)
  ERC20Mintable.setProvider(provider)
  ERC20Mintable.defaults({ from: safeOwner })
  erc20 = await ERC20Mintable.deployed()

  ConditionalTokens = TruffleContract(ConditionalTokensJson)
  ConditionalTokens.setProvider(provider)
  ConditionalTokens.defaults({ from: safeOwner })
  conditionalTokens = await ConditionalTokens.deployed()

  DailyLimitModule = TruffleContract(DailyLimitModuleJson)
  DailyLimitModule.setProvider(provider)
  DailyLimitModule.defaults({ from: safeOwner })
  dailyLimitModule = await DailyLimitModule.deployed()
}

export const getContracts = (): TestContracts => ({
  CPKFactory,
  GnosisSafe,
  GnosisSafeProxyFactory,
  MultiSend,
  DefaultCallbackHandler,
  MultiStep,
  ERC20Mintable,
  ConditionalTokens,
  DailyLimitModule
})

export const getContractInstances = (): TestContractInstances => ({
  cpkFactory,
  gnosisSafe,
  gnosisSafeProxyFactory,
  multiSend,
  defaultCallbackHandler,
  multiStep,
  erc20,
  conditionalTokens,
  dailyLimitModule
})
