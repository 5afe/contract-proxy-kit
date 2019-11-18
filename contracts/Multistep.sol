pragma solidity >=0.5.0 <0.7.0;

contract Multistep {
    mapping(address => uint) public lastStepFinished;

    function doStep(uint step) external {
        require(lastStepFinished[msg.sender] + 1 == step, "must do the next step");
        lastStepFinished[msg.sender]++;
    }
}
