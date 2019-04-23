/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";


contract ITap {
    function updateVault(Vault _vault) external;
    function updatePool(Pool _pool) external;
    function addTokenTap(address _token, uint256 _tap) external ;
    function removeTokenTap(address _token) external;
    function updateTokenTap(address _token, uint256 _tap) external;
    function withdraw(address _token) external;
    function isMonthlyTapIncreaseValid(address _token, uint256 _tap) public view returns (bool);
    function poolBalance(address _token) public view returns (uint256);
    function getMaxWithdrawal(address _token) public view returns (uint256);
}
