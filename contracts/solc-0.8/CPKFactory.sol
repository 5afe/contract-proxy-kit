// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { IGnosisSafeProxyFactory } from "./dep-ports/IGnosisSafeProxyFactory.sol";
import { ProxyImplSetter } from "./ProxyImplSetter.sol";

struct CPKFactoryTx {
    uint value;
    bytes data;
}

contract CPKFactory {
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
        CPKFactoryTx[] calldata txs
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

        uint sumTxsValues = 0;
        bytes memory lastReturnData;
        for (uint i = 0; i < txs.length; i++) {
            bool txSuccess;
            uint txValue = txs[i].value;
            sumTxsValues += txValue;
            (txSuccess, lastReturnData) = proxy.call{value: txValue}(txs[i].data);
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

        // it is up to the caller to make sure that the msg.value of this method
        // equals the sum of all the values in the txs
        require(msg.value == sumTxsValues, "msg.value must equal sum of txs' values");

        // final call in txs is assumed to be execTransaction
        execTransactionSuccess = abi.decode(lastReturnData, (bool));

        emit CPKCreation(proxy, safeVersion, owner, salt);
    }
}
