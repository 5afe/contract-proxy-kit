// SPDX-License-Identifier: GPL-3.0-only
pragma solidity >=0.8.0;

// bytes4(keccak256("isValidSignature(bytes,bytes)")
bytes4 constant EIP1271_MAGIC_VALUE = 0x20c13b0b;

interface ISignatureValidator {

    /**
    * @dev Should return whether the signature provided is valid for the provided data
    * @param _data Arbitrary length data signed on the behalf of address(this)
    * @param _signature Signature byte array associated with _data
    *
    * MUST return the bytes4 magic value 0x20c13b0b when function passes.
    * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc > 0.5)
    * MUST allow external calls
    */
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature)
        external
        view
        returns (bytes4);
}
