pragma solidity 0.4.24;


contract IMarketMakerController {
    function openCampaign() external;
    function resetTokenTap(address _token) external;
    function tokensToHold(address _token) public view returns (uint256);
    function balanceOf(address _who, address _token) public view returns (uint256);
}
