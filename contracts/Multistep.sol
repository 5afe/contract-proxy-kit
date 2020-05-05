pragma solidity >=0.5.0 <0.7.0;

import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract Multistep {
    event ExpensiveHashMade(bytes32 h);

    mapping(address => uint) public lastStepFinished;

    function makeExpensiveHash(uint v) internal {
        bytes32 h = bytes32(v);
        for (uint i = 0; i < 64; i++) {
            h = keccak256(abi.encode(v));
        }
        emit ExpensiveHashMade(h);
    }

    function doStep(uint step) external {
        require(lastStepFinished[msg.sender] + 1 == step, "must do the next step");
        lastStepFinished[msg.sender]++;
        makeExpensiveHash(step);
    }

    function doEtherStep(uint step) external payable {
        require(lastStepFinished[msg.sender] + 1 == step, "must do the next ether step");
        require(msg.value >= step * 1 ether, "must provide right amount of ether");
        lastStepFinished[msg.sender]++;
        msg.sender.transfer(msg.value - step * 1 ether);
        makeExpensiveHash(step);
    }

    function doERC20Step(uint step, IERC20 token) external payable {
        require(lastStepFinished[msg.sender] + 1 == step, "must do the next ERC20 step");
        lastStepFinished[msg.sender]++;
        require(token.transferFrom(msg.sender, address(this), step * 1 ether), "could not transfer right amount of ERC20");
        makeExpensiveHash(step);
    }
}
