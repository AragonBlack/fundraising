pragma solidity ^0.4.24;

import "@aragon/os/contracts/lib/token/ERC20.sol";


interface IPresale {
    function open() external;
    function close() external;
    function contribute(address _contributor, uint256 _value) external payable;
    function refund(address _contributor, uint256 _vestedPurchaseId) external;
    function contributionToTokens(uint256 _value) external view returns (uint256);
    function getContributionToken() external view returns (address);
}
