pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";


import "@ablack/fundraising-interfaces/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-interfaces/contracts/IBancorCurve.sol";
import "@ablack/fundraising-interfaces/contracts/ITap.sol";


contract ApiaryController is EtherTokenConstant, IsContract, IMarketMakerController, AragonApp {
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO_ROLE = keccak256("UPDATE_RESERVE_RATIO_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");

    Pool public _pool;
    IBancorCurve public curve;
    ITap public tap;


    function initialize(IBancorCurve _curve, ITap _tap, Pool __pool) {
        // should we turn the initialize function into a deploying
        // function installing all the relevant apps
        initialized();
        tap   = _tap;
        curve = _curve;
        _pool = __pool;
    }

    function addCollateralToken(address _token, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _tap) external auth(ADD_COLLATERAL_TOKEN_ROLE) {
        // input checks are already performed by the marketMaker and tap contracts
        curve.addCollateralToken(_token, _virtualSupply, _virtualBalance, _reserveRatio);
        tap.addTokenTap(_token, _tap);
        // events are already emitted by the marketMaker and tap contracts

    }

    function updateTokenTap(address _token, uint256 _tap) external auth(UPDATE_TOKEN_TAP_ROLE) {
        tap.updateTokenTap(_token, _tap);
    }

    function updateReserveRatio(address _collateralToken, uint32 _reserveRatio)  external auth(UPDATE_RESERVE_RATIO) {
        
    }

    function createBuyOrder() external auth(CREATE_BUY_ORDER_ROLE) {

    }

    function createSellOrder() external auth(CREATE_SELL_ORDER_ROLE) {

    }

    function pool() public view returns (address) {
        return address(_pool);
    }


    function poolBalance(address _collateralToken) public returns (uint256) {
        return uint256(1);
    }


    /***** internal functions *****/

    // function _addCollateralToken(address _token, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _tap) internal {
        
    //     // events are already emitted by the the curve and tap contracts
    // }

    // function _updateTokenTap(address _token, uint256 _tap) internal {
    //     // events are already emitted by the the curve and tap contracts
    // }

    // function _createBuyOrder() internal {

    // }

    // function _createSellOrder() internal {

    // }

}