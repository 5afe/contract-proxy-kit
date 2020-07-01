pragma solidity >=0.5.0 <0.7.0;

import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { Module } from "@gnosis.pm/safe-contracts/contracts/base/Module.sol";
import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import { BaseRelayRecipient } from "./gsn/BaseRelayRecipient.sol";

contract GsnModule is Module, BaseRelayRecipient {

    function setForwarder(address forwarder) public {
        require(trustedForwarder==address(0), "Forwrader already set");
        trustedForwarder=forwarder;
    }


    function execCall(GnosisSafe proxy, address to, bytes calldata data,Enum.Operation operation) external {
        require( proxy.isOwner(_msgSender()), "execCall: not owner");
        proxy.execTransactionFromModule(to, 0, data, operation);
    }

    //called as delegatecall during setup, to add this GsnModule as a module.
    // since its a delegateCall, "this" is the GnosisSafe itself, and the module (real this) is a parameter...
    function setup(GsnModule gsnModule) external {

        GnosisSafe(address(uint160(address(this)))).enableModule(gsnModule);
    }

}
