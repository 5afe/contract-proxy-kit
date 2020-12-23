pragma solidity >=0.5.0 <0.7.0;

import { GnosisSafeProxy } from "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxy.sol";
import { GnosisSafeProxyFactory } from "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxyFactory.sol";
import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
import { ProxyImplSetter } from "./ProxyImplSetter.sol";

contract CPKFactory {
    ProxyImplSetter public proxyImplSetter;
    GnosisSafeProxyFactory public gnosisSafeProxyFactory;

    constructor(GnosisSafeProxyFactory _gnosisSafeProxyFactory) public {
        proxyImplSetter = new ProxyImplSetter(address(this));
        gnosisSafeProxyFactory = _gnosisSafeProxyFactory;
    }

    event ProxyCreation(GnosisSafeProxy proxy);

    function proxyCreationCode() external pure returns (bytes memory) {
        return type(GnosisSafeProxy).creationCode;
    }

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

        gnosisSafeProxyFactory.createProxyWithNonce(
            proxyImplSetter,
            abi.encodeWithSelector(proxyImplSetter.setImplementation.selector, safeVersion),
            saltNonce
        );

        {
            address[] memory tmp = new address[](1);
            tmp[0] = address(owner);
            GnosisSafe(proxy).setup(tmp, 1, address(0), "", fallbackHandler, address(0), 0, address(0));
        }

        proxy.call.value(msg.value)(execTxCalldata);

        emit ProxyCreation(GnosisSafeProxy(proxy));
    }
}
