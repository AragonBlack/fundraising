/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

import "@ablack/fundraising-interface-core/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import { BancorMarketMaker } from "../../BancorMarketMaker.sol";


contract SimpleMarketMakerController is IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;

    function initialize() external onlyInit {
        initialized();
    }

    function balanceOf(address _who, address _collateralToken) public view returns (uint256) {
         if (_collateralToken == ETH) {
            return _who.balance;
        } else {
            return ERC20(_collateralToken).staticBalanceOf(_who);
        }
    }
}
