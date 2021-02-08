const TruffleContract = require('@truffle/contract')
import Web3Maj1Min3 from 'web3-1-3'
import ConditionalTokensJson from '../../build/contracts/ConditionalTokens.json'
import CPKFactoryJson from '../../build/contracts/CPKFactory.json'
import DailyLimitModuleJson from '../../build/contracts/DailyLimitModule.json'
import DefaultCallbackHandlerJson from '../../build/contracts/DefaultCallbackHandler.json'
import ERC20MintableJson from '../../build/contracts/ERC20Mintable.json'
import GnosisSafeJson from '../../build/contracts/GnosisSafe.json'
import GnosisSafe2Json from '../../build/contracts/GnosisSafe2.json'
import GnosisSafeProxyFactoryJson from '../../build/contracts/GnosisSafeProxyFactory.json'
import MultiSendJson from '../../build/contracts/MultiSend.json'
import MultistepJson from '../../build/contracts/Multistep.json'
import { Address } from '../../src/utils/basicTypes'

let CPKFactory: any
let GnosisSafe: any
let GnosisSafe2: any
let GnosisSafeProxyFactory: any
let MultiSend: any
let DefaultCallbackHandler: any
let MultiStep: any
let ERC20Mintable: any
let ConditionalTokens: any
let DailyLimitModule: any

let cpkFactory: any
let gnosisSafe: any
let gnosisSafe2: any
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
  gnosisSafe2: any
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
  GnosisSafe2: any
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

  GnosisSafe2 = TruffleContract(GnosisSafe2Json)
  GnosisSafe2.setProvider(provider)
  GnosisSafe2.defaults({ from: safeOwner })
  gnosisSafe2 = await GnosisSafe2.deployed()

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
  GnosisSafe2,
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
  gnosisSafe2,
  gnosisSafeProxyFactory,
  multiSend,
  defaultCallbackHandler,
  multiStep,
  erc20,
  conditionalTokens,
  dailyLimitModule
})
