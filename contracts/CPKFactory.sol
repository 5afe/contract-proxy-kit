pragma solidity >=0.5.0 <0.7.0;

import { GnosisSafeProxy } from "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxy.sol";
import { GnosisSafeProxyFactory } from "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { ProxyImplSetter } from "./ProxyImplSetter.sol";

contract CPKFactory {
    event CPKCreation(
        GnosisSafeProxy indexed proxy,
        address initialImpl,
        address initialOwner,
        uint256 saltNonceSalt
    );

    uint256 public constant version = 2;
    ProxyImplSetter public proxyImplSetter;
    GnosisSafeProxyFactory public gnosisSafeProxyFactory;

    constructor(GnosisSafeProxyFactory _gnosisSafeProxyFactory) public {
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
        uint256 saltNonceSalt,
        address fallbackHandler,
        bytes calldata execTxCalldata
    )
        external
        payable
        returns (bool execTransactionSuccess)
    {
        bytes32 saltNonce = keccak256(abi.encode(owner, saltNonceSalt));

        address payable proxy = address(gnosisSafeProxyFactory.createProxyWithNonce(
            address(proxyImplSetter),
            "",
            uint256(saltNonce)
        ));

        ProxyImplSetter(proxy).setImplementation(safeVersion);

        {
            address[] memory tmp = new address[](1);
            tmp[0] = address(owner);
            GnosisSafe(proxy).setup(tmp, 1, address(0), "", fallbackHandler, address(0), 0, address(0));
        }

        proxy.call.value(msg.value)(execTxCalldata);

        emit CPKCreation(GnosisSafeProxy(proxy), safeVersion, owner, saltNonceSalt);
    }
}
