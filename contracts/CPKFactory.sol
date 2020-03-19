pragma solidity >=0.5.0 <0.7.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import { Proxy } from "@gnosis.pm/safe-contracts/contracts/proxies/Proxy.sol";
import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";

contract CPKFactory {
    event ProxyCreation(Proxy proxy);

    function proxyCreationCode() external pure returns (bytes memory) {
        return type(Proxy).creationCode;
    }

    function proxyRuntimeCode() external pure returns (bytes memory) {
        return type(Proxy).runtimeCode;
    }

    function proxyRuntimeCodeHash() external pure returns (bytes32 digest) {
        return keccak256(type(Proxy).runtimeCode);
    }

    function createProxyAndExecTransaction(
        address masterCopy,
        uint256 saltNonce,
        address fallbackHandler,
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    )
        external
        returns (bool execTransactionSuccess)
    {
        GnosisSafe proxy;
        bytes memory deploymentData = abi.encodePacked(type(Proxy).creationCode, abi.encode(masterCopy));
        bytes32 salt = keccak256(abi.encode(msg.sender, saltNonce));
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        require(address(proxy) != address(0), "create2 call failed");

        {
            address[] memory tmp = new address[](1);
            tmp[0] = address(this);
            proxy.setup(tmp, 1, address(0), "", fallbackHandler, address(0), 0, address(0));
        }

        execTransactionSuccess = proxy.execTransaction(to, value, data, operation, 0, 0, 0, address(0), address(0),
            abi.encodePacked(uint(address(this)), uint(0), uint8(1)));

        proxy.execTransaction(
            address(proxy), 0,
            abi.encodeWithSignature("swapOwner(address,address,address)", address(1), address(this), msg.sender),
            Enum.Operation.Call,
            0, 0, 0, address(0), address(0),
            abi.encodePacked(uint(address(this)), uint(0), uint8(1))
        );

        emit ProxyCreation(Proxy(address(proxy)));
   }
}
