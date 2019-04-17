/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

import "@aragonblack/fundraising-core/contracts/IMarketMakerController.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";

contract SimpleMarketMakerController is IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;

    Pool private _pool;

    function initialize(Pool __pool) external onlyInit {
        _pool = __pool;
    }

    function pool() public returns (address) {
        return address(_pool);
    }
    
    function poolBalance(address _collateralToken) public returns (uint256) {
        return ERC20(_collateralToken).staticBalanceOf(address(_pool));
    }
}
