pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";

import "@ablack/fundraising-interfaces/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-interfaces/contracts/IBancorCurve.sol";
import "@ablack/fundraising-interfaces/contracts/ITap.sol";


contract ApiaryController is EtherTokenConstant, IsContract, IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO_ROLE = keccak256("UPDATE_RESERVE_RATIO_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");

    Pool public _pool;
    IBancorCurve public curve;
    ITap public tap;


    function initialize(IBancorCurve _curve, ITap _tap, Pool __pool) {
        initialized();
        tap   = _tap;
        curve = _curve;
        _pool = __pool;
    }

    function addCollateralToken(address _token, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _tap) external auth(ADD_COLLATERAL_TOKEN_ROLE) {
        // input checks are already performed by the MarketMaker and Tap contracts
        tap.addTokenTap(_token, _tap);
        curve.addCollateralToken(_token, _virtualSupply, _virtualBalance, _reserveRatio);
        // events are already emitted by the MarketMaker and Tap contracts

    }

    /**
    @dev Get whether a collateral token exists
    @param _collateralToken The address of the collateral token used.
    @return Whether or not the collateral token exists.
    */
    function isCollateralToken(address _collateralToken) external view returns (bool exists) {
        (exists, , , ) = curve.collateralTokenInfo(_collateralToken);
    }

    // function updateMaxTapRateIncrease

    function updateTokenTap(address _token, uint256 _tap) external auth(UPDATE_TOKEN_TAP_ROLE) {
        tap.updateTokenTap(_token, _tap);
    }

    function updateReserveRatio(address _collateralToken, uint32 _reserveRatio)  external auth(UPDATE_RESERVE_RATIO_ROLE) {
        curve.updateReserveRatio(_collateralToken, _reserveRatio);
    }

    function createBuyOrder(address _collateralToken, uint256 _value) payable external auth(CREATE_BUY_ORDER_ROLE) {
        curve.call.value(msg.value)(bytes4(keccak256("createBuyOrder(address,address,uint256)")), msg.sender, _collateralToken, _value);
        // curve.createBuyOrder.call.value(msg.value)(msg.sender, _collateralToken, _value);


    }

    function createSellOrder(address _collateralToken, uint256 _amount) external auth(CREATE_SELL_ORDER_ROLE) {
        curve.createSellOrder(msg.sender, _collateralToken, _amount);
    }

    function pool() public view returns (address) {
        return address(_pool);
    }

    function poolBalance(address _collateralToken) public view returns (uint256) {
        uint256 balance = _collateralToken == ETH ? address(_pool).balance : ERC20(_collateralToken).staticBalanceOf(_pool);
        uint256 maxWithdrawal = tap.getMaxWithdrawal(_collateralToken);
    
        return balance.sub(maxWithdrawal);
    }
}