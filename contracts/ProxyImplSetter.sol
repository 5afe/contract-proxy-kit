pragma solidity >=0.5.0 <0.7.0;

contract ProxyImplSetter {
    address implementation;

    function setImplementation(address _implementation) external {
        implementation = _implementation;
    }
}
