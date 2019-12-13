pragma solidity 0.4.24;


contract IPresale {
    function open() external;
    function close() external;
    function contribute(address _contributor, uint256 _value) external payable;
    function refund(address _contributor, uint256 _vestedPurchaseId) external;
    function contributionToTokens(uint256 _value) public view returns (uint256);
    function contributionToken() public view returns (address);
 }