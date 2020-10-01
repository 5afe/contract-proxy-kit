pragma solidity >=0.5.0 <0.7.0;

import { ProxyFactory } from "@gnosis.pm/safe-contracts/contracts/proxies/ProxyFactory.sol";
import { MultiSend } from "@gnosis.pm/safe-contracts/contracts/libraries/MultiSend.sol";
import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { DefaultCallbackHandler } from "@gnosis.pm/safe-contracts/contracts/handler/DefaultCallbackHandler.sol";
import { DailyLimitModule } from "@gnosis.pm/safe-contracts/contracts/modules/DailyLimitModule.sol";
import { ConditionalTokens } from "@gnosis.pm/conditional-tokens-contracts/contracts/ConditionalTokens.sol";
import { ERC20Mintable } from "openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol";
