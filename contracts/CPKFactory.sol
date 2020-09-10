pragma solidity >=0.5.0 <0.7.0;

import { GnosisSafeProxy } from "@gnosis.pm/safe-contracts/contracts/proxies/GnosisSafeProxy.sol";
import { GnosisSafe } from "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";

contract CPKFactory {
    //keccak256(
    //    "EIP712Domain(address verifyingContract)"
    //);
    bytes32 private constant DOMAIN_SEPARATOR_TYPEHASH = 0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749;

    //keccak256(
    //    "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
    //);
    bytes32 private constant SAFE_TX_TYPEHASH = 0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8;

    ProxyImplSetter public proxyImplSetter;

    constructor() public {
        proxyImplSetter = new ProxyImplSetter();
    }

    event ProxyCreation(GnosisSafeProxy proxy);

    function proxyCreationCode() external pure returns (bytes memory) {
        return type(GnosisSafeProxy).creationCode;
    }

    function createProxyAndExecTransaction(
        address owner,
        address safeVersion,
        uint256 saltNonce,
        address fallbackHandler,
        bytes calldata execTxCalldata
    )
        external
        payable
        returns (bool execTransactionSuccess)
    {
        bytes32 salt = keccak256(abi.encode(owner, saltNonce));

        address payable proxy;
        {
            bytes memory deploymentData = abi.encodePacked(
                type(GnosisSafeProxy).creationCode,
                abi.encode(proxyImplSetter)
            );
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
            }
            require(proxy != address(0), "create2 call failed");
        }

        ProxyImplSetter(proxy).setImplementation(safeVersion);

        {
            address[] memory tmp = new address[](1);
            tmp[0] = address(owner);
            GnosisSafe(proxy).setup(tmp, 1, address(0), "", fallbackHandler, address(0), 0, address(0));
        }

        proxy.call.value(msg.value)(execTxCalldata);

        emit ProxyCreation(GnosisSafeProxy(proxy));
    }
}
