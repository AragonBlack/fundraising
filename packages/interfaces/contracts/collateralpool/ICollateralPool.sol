pragma solidity ^0.4.24;


contract ICollateralPool {
    function deposit(address _token, uint256 _value) external payable;
    function transfer(address _token, uint256 _value) external;
    function execute(address _target, bytes _data) external;
}
