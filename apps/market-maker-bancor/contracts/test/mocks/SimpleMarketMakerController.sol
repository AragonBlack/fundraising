/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

import "@ablack/fundraising-interface-core/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import { BondingCurve } from "../../BondingCurve.sol";


contract SimpleMarketMakerController is IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;

    // Pool private _pool;
    BondingCurve private _curve;
    address public beneficiary;

    function initialize(Pool __pool, BondingCurve __curve, address _beneficiary) external onlyInit {
        pool = __pool;
        _curve = __curve;
        beneficiary = _beneficiary;
    }

    // uint256 public collateralTokensLength;
    // mapping(uint256 => address) public collateralTokens;
    // mapping(address => Collateral) public collateralTokenInfo;
    // struct Collateral {
    //     bool exists;
    //     uint32 reserveRatio;
    //     uint256 virtualSupply;
    //     uint256 virtualBalance;
    //     mapping(uint256=>Batch) batches;
    //     mapping(address=>uint256[]) addressToBlocks;
    // }

    function isCollateralToken(address _collateralToken) external view returns (bool exists) {
        (exists, , , ) = _curve.collateralTokenInfo(_collateralToken);
    }

    function reserveRatio(address _collateralToken) public view returns (uint32 _reserveRatio) {
        (, _reserveRatio, ,) = _curve.collateralTokenInfo(_collateralToken);
    }

    function virtualSupply(address _collateralToken) public view returns (uint256 _virtualSupply) {
        (, ,_virtualSupply,) = _curve.collateralTokenInfo(_collateralToken);
    }

    function virtualBalance(address _collateralToken) public view returns (uint256 _virtualBalance) {
        (, , , _virtualBalance) = _curve.collateralTokenInfo(_collateralToken);
    }

    // function pool() public view returns (address) {
    //     return address(_pool);
    // }
    
    function poolBalance(address _collateralToken) public view returns (uint256) {
        if (_collateralToken == ETH) {
            return address(pool).balance;
        } else {
            return ERC20(_collateralToken).staticBalanceOf(address(pool));
        }
    }

}
