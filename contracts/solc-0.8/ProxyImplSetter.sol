// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

contract ProxyImplSetter {
    address public immutable initialSetter;

    address implementation;

    constructor(address _initialSetter) {
        initialSetter = _initialSetter;
    }

    function setImplementation(address _implementation) external {
        require(msg.sender == initialSetter, "Implementation must be set by designated initial setter");
        implementation = _implementation;
    }
}
