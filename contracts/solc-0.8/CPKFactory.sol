// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { IGnosisSafeProxyFactory } from "./dep-ports/IGnosisSafeProxyFactory.sol";
import { ProxyImplSetter } from "./ProxyImplSetter.sol";

contract CPKFactory {
    event CPKCreation(
        address indexed proxy,
        address initialImpl,
        address initialOwner,
        uint256 salt
    );

    uint256 public constant version = 2;
    ProxyImplSetter public proxyImplSetter;
    IGnosisSafeProxyFactory public gnosisSafeProxyFactory;

    constructor(IGnosisSafeProxyFactory _gnosisSafeProxyFactory) {
        proxyImplSetter = new ProxyImplSetter(address(this));
        gnosisSafeProxyFactory = _gnosisSafeProxyFactory;
    }

    // Accessors removed until something is figured out about the fact that these depend on the compiler
    // but really should depend instead on the specific gnosisSafeProxyFactory instance used

    // function proxyCreationCode() external pure returns (bytes memory) {
    //     return type(GnosisSafeProxy).creationCode;
    // }

    // function proxyRuntimeCode() external pure returns (bytes memory) {
    //     return type(GnosisSafeProxy).runtimeCode;
    // }

    // bytes32 public constant proxyExtCodeHash = keccak256(type(GnosisSafeProxy).runtimeCode);

    function createProxyAndExecTransaction(
        address owner,
        address safeVersion,
        uint256 salt,
        bytes[] calldata txsCalldata
    )
        external
        payable
        returns (bool execTransactionSuccess)
    {
        bytes32 saltNonce = keccak256(abi.encode(owner, salt));

        address payable proxy = gnosisSafeProxyFactory.createProxyWithNonce(
            address(proxyImplSetter),
            "",
            uint256(saltNonce)
        );

        ProxyImplSetter(proxy).setImplementation(safeVersion);

        bytes memory lastReturnData;

        for (uint i = 0; i < txsCalldata.length; i++) {
            bool txSuccess;
            (txSuccess, lastReturnData) = proxy.call{value: msg.value}(txsCalldata[i]);
            assembly {
                // txSuccess == 0 means the call failed
                if iszero(txSuccess) {
                    // The revert data begins one word after the lastReturnData pointer.
                    // At the location lastReturnData in memory, the length of the bytes is stored.
                    // This differs from the high-level revert(string(lastReturnData))
                    // as the high-level version encodes the lastReturnData in a Error(string) object.
                    // We want to avoid that because the underlying call should have already
                    // formatted the data in an Error(string) object
                    revert(add(0x20, lastReturnData), mload(lastReturnData))
                }
            }
        }

        // final call in txsCalldata is assumed to be execTransaction
        execTransactionSuccess = abi.decode(lastReturnData, (bool));

        emit CPKCreation(proxy, safeVersion, owner, salt);
    }
}
