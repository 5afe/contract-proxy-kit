// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { IGnosisSafe } from "./dep-ports/IGnosisSafe.sol";
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
        address fallbackHandler,
        bytes calldata execTxCalldata
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

        {
            address[] memory tmp = new address[](1);
            tmp[0] = address(owner);
            IGnosisSafe(proxy).setup(tmp, 1, address(0), "", fallbackHandler, address(0), 0, payable(0));
        }

        proxy.call{value: msg.value}(execTxCalldata);

        emit CPKCreation(proxy, safeVersion, owner, salt);
    }
}
