// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { Enum } from "./Enum.sol";

interface IGnosisSafe {
    function setup(
        address[] calldata _owners,
        uint256 _threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}
