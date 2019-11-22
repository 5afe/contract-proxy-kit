pragma solidity >=0.5.0 <0.7.0;

import { Proxy } from "@gnosis.pm/safe-contracts/contracts/proxies/Proxy.sol";

contract SafeProxyFactory {
    event ProxyCreation(Proxy proxy);

    function proxyCreationCode() external pure returns (bytes memory) {
        return type(Proxy).creationCode;
    }

    function createSafeProxy(address masterCopy, uint256 saltNonce, address delegatecallTarget, bytes calldata initialCalldata)
        external
        returns (Proxy proxy)
    {
        bytes memory deploymentData = abi.encodePacked(type(Proxy).creationCode, abi.encode(masterCopy));
        bytes32 salt = keccak256(abi.encode(msg.sender, saltNonce));
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        require(address(proxy) != address(0), "create2 call failed");

        if (initialCalldata.length > 0) {
            (bool success, bytes memory retdata) = address(delegatecallTarget).delegatecall(initialCalldata);
            require(success, string(retdata));
        }
        emit ProxyCreation(proxy);
   }
}
