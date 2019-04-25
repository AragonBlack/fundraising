/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

import "@ablack/fundraising-interfaces/contracts/IMarketMakerController.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";
import { BancorCurve } from "../../BancorCurve.sol";


contract SimpleMarketMakerController is IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;

    Pool private _pool;
    BancorCurve private _curve;

    function initialize(Pool __pool, BancorCurve __curve) external onlyInit {
        _pool = __pool;
        _curve = __curve;
        initialized();
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

    function isCollateralToken(address _collateralToken) public view isInitialized returns (bool _exists) {
        (_exists, , , ) = _curve.collateralTokenInfo(_collateralToken);
    }

    function reserveRatio(address _collateralToken) public view isInitialized returns (uint32 _reserveRatio) {
        (, _reserveRatio, ,) = _curve.collateralTokenInfo(_collateralToken);
    }

    function virtualSupply(address _collateralToken) public view isInitialized returns (uint256 _virtualSupply) {
        (, ,_virtualSupply,) = _curve.collateralTokenInfo(_collateralToken);
    }

    function virtualBalance(address _collateralToken) public view isInitialized returns (uint256 _virtualBalance) {
        (, , , _virtualBalance) = _curve.collateralTokenInfo(_collateralToken);
    }

    function pool() public view isInitialized returns (address) {
        return address(_pool);
    }
    
    function poolBalance(address _collateralToken) public isInitialized returns (uint256) {
        return ERC20(_collateralToken).staticBalanceOf(address(_pool));
    }
}
