// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { IGnosisSafeProxyFactory } from "./dep-ports/IGnosisSafeProxyFactory.sol";
import { ProxyImplSetter } from "./ProxyImplSetter.sol";
import { SafeSignatureUtils } from "./SafeSignatureUtils.sol";

enum TxReaction {
    RevertOnReturnFalse,
    CaptureBoolReturn,
    IgnoreReturn
}

struct CPKFactoryTx {
    uint value;
    bytes data;
    TxReaction reaction;
}

contract CPKFactory {
    using SafeSignatureUtils for bytes;

    event CPKCreation(
        address indexed proxy,
        address initialImpl,
        address initialOwner,
        uint256 salt
    );

    uint256 public constant version = 2;
    ProxyImplSetter public immutable proxyImplSetter;
    IGnosisSafeProxyFactory public immutable gnosisSafeProxyFactory;
    bytes32 public immutable proxyExtCodeHash;

    constructor(IGnosisSafeProxyFactory _gnosisSafeProxyFactory) {
        proxyImplSetter = new ProxyImplSetter(address(this));
        gnosisSafeProxyFactory = _gnosisSafeProxyFactory;
        proxyExtCodeHash = keccak256(_gnosisSafeProxyFactory.proxyRuntimeCode());
    }

    function proxyCreationCode() external view returns (bytes memory) {
        return gnosisSafeProxyFactory.proxyCreationCode();
    }

    function proxyRuntimeCode() external view returns (bytes memory) {
        return gnosisSafeProxyFactory.proxyRuntimeCode();
    }

    function createProxyAndExecTransaction(
        address owner,
        address safeVersion,
        uint256 salt,
        CPKFactoryTx[] calldata txs,
        bytes calldata signature
    )
        external
        payable
        returns (bool execTransactionSuccess)
    {
        bytes memory data = abi.encode(safeVersion, salt, txs);
        bytes32 dataHash = keccak256(data);
        signature.check(dataHash, data, owner);

        bytes32 saltNonce = keccak256(abi.encode(owner, salt));

        address payable proxy = gnosisSafeProxyFactory.createProxyWithNonce(
            address(proxyImplSetter),
            "",
            uint256(saltNonce)
        );

        ProxyImplSetter(proxy).setImplementation(safeVersion);

        uint sumTxsValues = 0;
        for (uint i = 0; i < txs.length; i++) {
            bool txSuccess;
            bytes memory returnData;
            uint txValue = txs[i].value;
            sumTxsValues += txValue;
            (txSuccess, returnData) = proxy.call{value: txValue}(txs[i].data);
            assembly {
                // txSuccess == 0 means the call failed
                if iszero(txSuccess) {
                    // The revert data begins one word after the returnData pointer.
                    // At the location returnData in memory, the length of the bytes is stored.
                    // This differs from the high-level revert(string(returnData))
                    // as the high-level version encodes the returnData in a Error(string) object.
                    // We want to avoid that because the underlying call should have already
                    // formatted the data in an Error(string) object
                    revert(add(0x20, returnData), mload(returnData))
                }
            }

            TxReaction txReaction = txs[i].reaction;
            if (txReaction == TxReaction.RevertOnReturnFalse) {
                bool success = abi.decode(returnData, (bool));
                require(success, "tx returned boolean indicating internal failure");
            } else if (txReaction == TxReaction.CaptureBoolReturn) {
                execTransactionSuccess = abi.decode(returnData, (bool));
            } // else txReaction assumed to be IgnoreReturn, which does nothing else here
        }

        // it is up to the caller to make sure that the msg.value of this method
        // equals the sum of all the values in the txs
        require(msg.value == sumTxsValues, "msg.value must equal sum of txs' values");

        emit CPKCreation(proxy, safeVersion, owner, salt);
    }
}
