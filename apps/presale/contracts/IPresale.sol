pragma solidity ^0.4.24;


interface IPresale {
    function open() external;
    function close() external;
    function contribute(address _contributor, uint256 _value) external payable;
    function refund(address _contributor, uint256 _vestedPurchaseId) external;
    function contributionToTokens(uint256 _value) external view returns (uint256);
}
