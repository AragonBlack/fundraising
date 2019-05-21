/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;


contract IMarketMakerController {
    address public pool;
    address public beneficiary;

    // function pool() public view returns (address);
    function poolBalance(address _collateralToken) public view returns (uint256);
}
