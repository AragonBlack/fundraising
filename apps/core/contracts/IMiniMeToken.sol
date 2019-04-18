pragma solidity 0.4.24;


contract IMiniMeToken {
    function controller() public constant returns (address);
    function transfersEnabled() public constant returns (bool);
    function balanceOf(address _owner) public constant returns (uint256);
    function totalSupply() public constant returns (uint);
    function enableTransfers(bool _transfersEnabled) public;
    function generateTokens(address _owner, uint _amount) public returns (bool);
    function destroyTokens(address _owner, uint _amount) public returns (bool);
}
