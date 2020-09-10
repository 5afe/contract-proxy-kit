pragma solidity >=0.5.0 <0.7.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import { CPKFactory } from "./CPKFactory.sol";

contract CPKFactoryFacade {
    CPKFactory cpkFactory;
    address safeVersion;
    uint256 saltNonce;
    address fallbackHandler;

    constructor(
        CPKFactory _cpkFactory,
        address _safeVersion,
        uint256 _saltNonce,
        address _fallbackHandler
    ) public {
        cpkFactory = _cpkFactory;
        safeVersion = _safeVersion;
        saltNonce = _saltNonce;
        fallbackHandler = _fallbackHandler;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes calldata signature
    )
        external
        payable
        returns (bool)
    {
        address owner;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            owner := and(
                calldataload(add(calldataload(0x124), 0x61)),
                0xffffffffffffffffffffffffffffffffffffffff
            )
        }

        return cpkFactory.createProxyAndExecTransaction.value(msg.value)(
            owner,
            safeVersion,
            saltNonce,
            fallbackHandler,
            msg.data
        );
    }
}