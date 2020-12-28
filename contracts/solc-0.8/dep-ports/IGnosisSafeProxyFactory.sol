// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

interface IGnosisSafeProxyFactory {
    function createProxyWithNonce(
        address impl,
        bytes calldata initializer,
        uint256 saltNonce
    ) external returns (address payable);
}
