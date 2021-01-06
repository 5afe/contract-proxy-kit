// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

import { ISignatureValidator, EIP1271_MAGIC_VALUE } from "./dep-ports/ISignatureValidator.sol";

library SafeSignatureUtils {
    // Adapted from SignatureDecoder
    function components(bytes memory signature)
        internal
        pure
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        // The signature format is a compact form of:
        //   {bytes32 r}{bytes32 s}{uint8 v}
        // Compact means, uint8 is not padded to 32 bytes.
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            // Here we are loading the last 32 bytes, including 31 bytes
            // of 's'. There is no 'mload8' to do this.
            //
            // 'byte' is not working due to the Solidity parser, so lets
            // use the second best option, 'and'
            v := and(mload(add(signature, 0x41)), 0xff)
        }
    }

    // Adapted from GnosisSafe
    function check(bytes memory signature, bytes32 dataHash, bytes memory data, address owner)
        internal
        view
    {
        // Check that the provided signature data is not too short
        require(signature.length >= 65, "Signature data too short");

        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = components(signature);

        address derivedOwner;
        // If v is 0 then it is a contract signature
        if (v == 0) {
            // When handling contract signatures the address of the contract is encoded into r
            derivedOwner = address(uint160(uint256(r)));

            uint256 contractSignatureLen = requireContractSignatureLength(signature, uint256(s));
            require(uint256(s) + 32 + contractSignatureLen <= signature.length, "Invalid contract signature location: data not complete");

            // Check signature
            bytes memory contractSignature;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                // The signature data for contract signatures is appended to the concatenated signatures and the offset is stored in s
                contractSignature := add(add(signature, s), 0x20)
            }
            require(ISignatureValidator(derivedOwner).isValidSignature(data, contractSignature) == EIP1271_MAGIC_VALUE, "Invalid contract signature provided");
        // If v is 1 then it is an approved hash
        } else if (v == 1) {
            // When handling approved hashes the address of the approver is encoded into r
            derivedOwner = address(uint160(uint256(r)));
            // Hashes are automatically approved by the sender of the message or when they have been pre-approved via a separate transaction
            require(msg.sender == derivedOwner);
        } else if (v > 30) {
            // To support eth_sign and similar we adjust v and hash the messageHash with the Ethereum message prefix before applying ecrecover
            derivedOwner = ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", dataHash)), v - 4, r, s);
        } else {
            // Use ecrecover with the messageHash for EOA signatures
            derivedOwner = ecrecover(dataHash, v, r, s);
        }
        require (derivedOwner == owner, "Invalid owner provided");
    }

    function requireContractSignatureLength(
        bytes memory signature,
        uint256 sigLoc
    )
        internal
        pure
        returns (uint256 contractSignatureLen)
    {
        // Check that signature data pointer (s) is not pointing inside the static part of the signatures bytes
        // This check is not completely accurate, since it is possible that more signatures than the threshold are send.
        // Here we only check that the pointer is not pointing inside the part that is being processed
        require(sigLoc >= 65, "Invalid contract signature location: inside static part");

        // Check that signature data pointer (s) is in bounds (points to the length of data -> 32 bytes)
        require(sigLoc + 32 <= signature.length, "Invalid contract signature location: length not present");

        // Check if the contract signature is in bounds: start of data is s + 32 and end is start + signature length
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            contractSignatureLen := mload(add(add(signature, sigLoc), 0x20))
        }
    }

    function actualLength(bytes memory signature)
        internal
        pure
        returns (uint256)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;
        (v, r, s) = components(signature);

        if (v == 0) {
            uint256 contractSignatureLen = requireContractSignatureLength(signature, uint256(s));
            return uint256(s) + 32 + contractSignatureLen;
        }

        return 0x41;
    }
}