// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { Enum } from "./dep-ports/Enum.sol";
import { CPKFactory, CPKFactoryTx } from "./CPKFactory.sol";

contract CPKFactoryFacade {
    CPKFactory cpkFactory;
    address safeVersion;
    uint256 salt;
    address fallbackHandler;

    constructor(
        CPKFactory _cpkFactory,
        address _safeVersion,
        uint256 _salt,
        address _fallbackHandler
    ) {
        cpkFactory = _cpkFactory;
        safeVersion = _safeVersion;
        salt = _salt;
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

        CPKFactoryTx[] memory txs = new CPKFactoryTx[](2);
        {
            address[] memory owners = new address[](1);
            owners[0] = address(owner);
            txs[0] = CPKFactoryTx({
                value: 0,
                data: abi.encodeWithSignature(
                    "setup("
                        "address[]," // owners
                        "uint256,"   // threshold
                        "address,"   // to
                        "bytes,"     // data
                        "address,"   // fallbackHandler
                        "address,"   // paymentToken
                        "uint256,"   // payment
                        "address"    // paymentReceiver
                    ")",
                    owners, uint256(1), address(0), "",
                    fallbackHandler, address(0), uint256(0), payable(0)
                )
            });
        }

        // msg.data works here as a substitute for encoding because this function's signature
        // exactly matches the execTransaction signature from the Gnosis Safe, so the calldata
        // encoding will be the same.
        txs[1] = CPKFactoryTx({
            value: msg.value,
            data: msg.data
        });

        return cpkFactory.createProxyAndExecTransaction{value: msg.value}(
            owner,
            safeVersion,
            salt,
            txs
        );
    }
}