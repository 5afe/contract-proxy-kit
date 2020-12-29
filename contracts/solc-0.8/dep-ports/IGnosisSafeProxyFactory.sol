// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

interface IGnosisSafeProxyFactory {
    function createProxyWithNonce(
        address impl,
        bytes calldata initializer,
        uint256 saltNonce
    ) external returns (address payable);

    /// @dev Allows to retrieve the runtime code of a deployed Proxy. This can be used to check that the expected Proxy was deployed.
    function proxyRuntimeCode() external pure returns (bytes memory);

    /// @dev Allows to retrieve the creation code used for the Proxy deployment. With this it is easily possible to calculate predicted address.
    function proxyCreationCode() external pure returns (bytes memory);
}
