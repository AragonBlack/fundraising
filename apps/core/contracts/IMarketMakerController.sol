/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;


contract IMarketMakerController {
    function pool() public returns (address);
    function poolBalance(address _collateralToken) public returns (uint256);
}
