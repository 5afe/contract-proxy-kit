pragma solidity >=0.5.0 <0.7.0;

contract ProxyImplSetter {
    address implementation;
    // KLUDGE: make this immutable after solc versions get fixed
    address public initialSetter;

    constructor(address _initialSetter) {
        initialSetter = _initialSetter;
    }

    function setImplementation(address _implementation) external {
        require(msg.sender == initialSetter, "Implementation must be set by designated initial setter");
        implementation = _implementation;
    }
}
