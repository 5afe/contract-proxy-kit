pragma solidity >=0.5.0 <0.7.0;

import { Enum } from "@gnosis.pm/safe-contracts/contracts/common/Enum.sol";
import { CPKFactory } from "./CPKFactory.sol";

contract CPKFactoryFacade {
    CPKFactory cpkFactory;
    address safeVersion;
    uint256 saltNonceSalt;
    address fallbackHandler;

    constructor(
        CPKFactory _cpkFactory,
        address _safeVersion,
        uint256 _saltNonceSalt,
        address _fallbackHandler
    ) public {
        cpkFactory = _cpkFactory;
        safeVersion = _safeVersion;
        saltNonceSalt = _saltNonceSalt;
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
        // the following assembly block extracts the owner from the signature data
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // 0x124 is the start of the calldata word for the signature parameter
            // since it's a dynamic type, it stores the offset to the part of the calldata
            // that stores the actual data being sent as a signature so we load the
            // offset to the data, and then load the first word of the data which is
            // the length of the signature. Adding this offset to the signature data position
            // lets us grab the trailing word of the signature, which we will interpret
            // as the owner.
            let sigPos := calldataload(0x124)
            owner := and(
                calldataload(add(sigPos, calldataload(sigPos))),
                0xffffffffffffffffffffffffffffffffffffffff
            )
        }

        return cpkFactory.createProxyAndExecTransaction.value(msg.value)(
            owner,
            safeVersion,
            saltNonceSalt,
            fallbackHandler,
            msg.data
        );
    }
}