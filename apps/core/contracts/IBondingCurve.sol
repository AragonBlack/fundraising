/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;


contract IBondingCurve {
    function addCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) external;
    function updateReserveRatio(address _collateralToken, uint32 _reserveRatio) external;
    function createBuyOrder(address _buyer, address _collateralToken, uint256 _value) external;
    function createSellOrder(address _seller, address _collateralToken, uint256 _amount) external;
    function clearBatches() external;
    function claimBuy(address _buyer, address _collateralToken, uint256 _batchId);
    function claimSell(address _seller, address _collateralToken, uint256 _batchId) external;
    function getPricePPM(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance) public view returns (uint256);
    function getCurrentBatchId() public view returns (uint256);
    function getBuy(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 _buyValue) public view returns (uint256);
    function getSell(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 _sellAmount) public view returns (uint256);
}
