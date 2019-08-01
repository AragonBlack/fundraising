/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;


contract IMarketMakerController {
    // address public pool;
    // address public beneficiary;

    function tokensToHold(address _token) public view returns (uint256);
    function balanceOf(address _who, address _token) public view returns (uint256);
}
