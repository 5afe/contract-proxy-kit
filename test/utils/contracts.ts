const TruffleContract = require('@truffle/contract');
import Web3Maj1Min2 from 'web3-1-2';
import CPKFactoryJson from '../../build/contracts/CPKFactory.json';
import GnosisSafeJson from '../../build/contracts/GnosisSafe.json';
import MultiSendJson from '../../build/contracts/MultiSend.json';
import DefaultCallbackHandlerJson from '../../build/contracts/DefaultCallbackHandler.json';
import ProxyFactoryJson from '../../build/contracts/ProxyFactory.json';
import MultistepJson from '../../build/contracts/Multistep.json';
import ERC20MintableJson from '../../build/contracts/ERC20Mintable.json';
import ConditionalTokensJson from '../../build/contracts/ConditionalTokens.json';
import { Address } from '../../src/utils/constants';

let CPKFactory: any;
let GnosisSafe: any;
let ProxyFactory: any;
let MultiSend: any;
let DefaultCallbackHandler: any;
let MultiStep: any;
let ERC20Mintable: any;
let ConditionalTokens: any;

let cpkFactory: any;
let gnosisSafe: any;
let proxyFactory: any;
let multiSend: any;
let defaultCallbackHandler: any;
let multiStep: any;
let erc20: any;
let conditionalTokens: any;

export interface TestContractInstances {
  cpkFactory: any;
  gnosisSafe: any;
  proxyFactory: any;
  multiSend: any;
  defaultCallbackHandler: any;
  multiStep: any;
  erc20: any;
  conditionalTokens: any;
}

export interface TestContracts {
  CPKFactory: any;
  GnosisSafe: any;
  ProxyFactory: any;
  MultiSend: any;
  DefaultCallbackHandler: any;
  MultiStep: any;
  ERC20Mintable: any;
  ConditionalTokens: any;
}

export const initializeContracts = async (safeOwner: Address, provider:any): Promise<void> => {

  CPKFactory = TruffleContract(CPKFactoryJson);
  CPKFactory.setProvider(provider);
  CPKFactory.defaults({ from: safeOwner });
  cpkFactory = await CPKFactory.deployed();
  
  GnosisSafe = TruffleContract(GnosisSafeJson);
  GnosisSafe.setProvider(provider);
  GnosisSafe.defaults({ from: safeOwner });
  gnosisSafe = await GnosisSafe.deployed();

  ProxyFactory = TruffleContract(ProxyFactoryJson);
  ProxyFactory.setProvider(provider);
  ProxyFactory.defaults({ from: safeOwner });
  proxyFactory = await ProxyFactory.deployed();
  
  MultiSend = TruffleContract(MultiSendJson);
  MultiSend.setProvider(provider);
  MultiSend.defaults({ from: safeOwner });
  multiSend = await MultiSend.deployed();
  
  DefaultCallbackHandler = TruffleContract(DefaultCallbackHandlerJson);
  DefaultCallbackHandler.setProvider(provider);
  DefaultCallbackHandler.defaults({ from: safeOwner });
  defaultCallbackHandler = await DefaultCallbackHandler.deployed();
  
  MultiStep = TruffleContract(MultistepJson);
  MultiStep.setProvider(provider);
  MultiStep.defaults({ from: safeOwner });
  multiStep = await MultiStep.deployed();
  
  ERC20Mintable = TruffleContract(ERC20MintableJson);
  ERC20Mintable.setProvider(provider);
  ERC20Mintable.defaults({ from: safeOwner });
  erc20 = await ERC20Mintable.deployed();
  
  ConditionalTokens = TruffleContract(ConditionalTokensJson);
  ConditionalTokens.setProvider(provider);
  ConditionalTokens.defaults({ from: safeOwner });
  conditionalTokens = await ConditionalTokens.deployed();
};

export const getContracts = (): TestContracts => ({
  CPKFactory,
  GnosisSafe,
  ProxyFactory,
  MultiSend,
  DefaultCallbackHandler,
  MultiStep,
  ERC20Mintable,
  ConditionalTokens,
});

export const getContractInstances = (): TestContractInstances => ({
  cpkFactory,
  gnosisSafe,
  proxyFactory,
  multiSend,
  defaultCallbackHandler,
  multiStep,
  erc20,
  conditionalTokens,
});
