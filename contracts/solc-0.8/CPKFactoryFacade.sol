// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { Enum } from "./dep-ports/Enum.sol";
import { CPKFactory, CPKFactoryTx, TxReaction } from "./CPKFactory.sol";
import { SafeSignatureUtils } from "./SafeSignatureUtils.sol";

contract CPKFactoryFacade {
    using SafeSignatureUtils for bytes;

    CPKFactory immutable cpkFactory;
    address immutable safeVersion;
    uint256 immutable salt;
    address immutable fallbackHandler;

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
        address /* to */,
        uint256 /* value */,
        bytes calldata /* data */,
        Enum.Operation /* operation */,
        uint256 /* safeTxGas */,
        uint256 /* baseGas */,
        uint256 /* gasPrice */,
        address /* gasToken */,
        address payable /* refundReceiver */,
        bytes calldata signatures
    )
        external
        payable
        returns (bool)
    {
        // The signatures here aren't just the Gnosis Safe signatures,
        // but more data has been appended to them. In particular, the
        // format for the signatures is now like the following:
        // [inner sig][owner][outer sig]
        // where the inner signature is what is submitted to the
        // proxy as a first transaction to be executed after its creation,
        // the owner is the address of the owner of the new proxy,
        // left-padded to 32 bytes, and the outer signature is the overall
        // signature required by the CPKFactory.
        // The following process copies this signatures data into memory,
        // and then figures out the length of the inner signature,
        // and then extracts the owner from the signatures in memory,
        // and then overwrites the owner in memory with the length
        // of the outer signature, which is just the remaining
        // bytes of the signature. We end up with a situation in memory like
        // [inner sig]*[outer sig length][outer sig]
        // where the * is the pointer assigned to outerSig.
        bytes memory outerSig;
        address owner;
        uint innerSigLen;
        {
            bytes memory innerSig = signatures;
            innerSigLen = innerSig.actualLength();
            uint outerSigLen = signatures.length - innerSigLen - 0x20;
            assembly {
                outerSig := add(add(innerSig, 0x20), innerSigLen)
                owner := mload(outerSig)
                mstore(outerSig, outerSigLen)
            }
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
                ),
                reaction: TxReaction.IgnoreReturn
            });
        }

        {
            // trying to reencode the msg.data with the params except instead
            // of signatures using innerSig would be the obvious and readable approach
            // except we run into stack too deep errors that can't be circumvented yet,
            // so instead we copy the entire msg.data into memory and
            // mutate the signatures portion in it.
            bytes memory innerTxData = msg.data;
            assembly {
                // index param 9 is signatures, and 9 * 0x20 + 4 = 0x124
                // 0x124 from the start of the data portion of innerTxData
                // contains the offset to the start of the word
                // containing a further offset of where the signatures data
                // begins.
                // We add 0x20 to account for the word containing the length
                // of innerTxData, making a total offset of 0x144 to the offset data
                // Then we add that offset, a word for the overall length, and
                // the pointer to innerTxData, to arrive at a pointer to the signatures
                // inside innerTxData
                let sigs := add(innerTxData, add(mload(add(innerTxData, 0x144)), 0x20))
                // Since we know the length of the inner signature, we get the
                // size reduction we need by subtracting the inner signature length
                // from the size of all the signature data
                let sizeReduction := sub(mload(sigs), innerSigLen)
                mstore(sigs, innerSigLen)
                // The size reduction is then used to cut the outer signature out
                // of the msg.data.
                // This assumes that the signatures data is the last chunk of data
                // in the msg.data.
                // We can't keep the outer signature in the inner transaction data
                // because the outer signature signs the inner transaction data,
                // so keeping that there would make the outer signature impossible
                // to generate.
                mstore(innerTxData, sub(mload(innerTxData), sizeReduction))
            }
            txs[1] = CPKFactoryTx({
                value: msg.value,
                data: innerTxData,
                reaction: TxReaction.CaptureBoolReturn
            });
        }

        return cpkFactory.createProxyAndExecTransaction{value: msg.value}(
            owner,
            safeVersion,
            salt,
            txs,
            outerSig
        );
    }
}