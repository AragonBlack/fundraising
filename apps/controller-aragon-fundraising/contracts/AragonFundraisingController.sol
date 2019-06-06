/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";

import "@ablack/fundraising-interface-core/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-market-maker-bancor/contracts/BancorMarketMaker.sol";
import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import "@ablack/fundraising-module-tap/contracts/Tap.sol";


contract AragonFundraisingController is EtherTokenConstant, IsContract, IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant UPDATE_MONTHLY_TAP_INCREASE_ROLE = keccak256("UPDATE_MONTHLY_TAP_INCREASE_ROLE");
    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    BancorMarketMaker public marketMaker;
    Pool public reserve;
    Tap public tap;

    /***** external functions *****/

    function initialize(BancorMarketMaker _marketMaker, Pool _reserve, Tap _tap) external {
        initialized();

        require(isContract(_marketMaker));
        require(isContract(_reserve));
        require(isContract(_tap));

        marketMaker = _marketMaker;
        reserve = _reserve;
        tap = _tap;
    }

    /* collateral tokens related functions */

    /**
     * @notice Add `_token.symbol(): string` as a whitelisted collateral token
     * @param _token The address of the collateral token to be added
     * @param _virtualSupply The virtual supply to be used for that collateral token
     * @param _virtualBalance The virtual balance to be used for that collateral token
     * @param _reserveRatio The reserve ratio to be used for that collateral token [in PPM]
     * @param _tap The tap to be applied applied to that token [in wei / second]
    */
    function addCollateralToken(address _token, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _tap)
    	external auth(ADD_COLLATERAL_TOKEN_ROLE)
    {
        tap.addTokenTap(_token, _tap);
        reserve.addCollateralToken(_token);
        marketMaker.addCollateralToken(_token, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    /**
     * @notice Update the fee percentage deducted from all buy and sell orders to respectively `@formatPct(_buyFee)` % and `@formatPct(_sellFee)` %
     * @param _buyFee The new buy fee to be used
     * @param _sellFee The new sell fee to be used
    */
    function updateFees(uint256 _buyFee, uint256 _sellFee) external auth(UPDATE_FEES_ROLE) {
        marketMaker.updateFees(_buyFee, _sellFee);
    }

    /* settings related functions */

    /**
     * @notice Update the beneficiary to `_beneficiary`
     * @param _beneficiary The new beneficiary to be used
    */
    function updateBeneficiary(address _beneficiary) external auth(UPDATE_BENEFICIARY_ROLE) {
        marketMaker.updateBeneficiary(_beneficiary);
        tap.updateBeneficiary(_beneficiary);
    }

    /* tap related functions */

    /**
     * @notice Update maximum monthly tap increase rate to `@formatPct(`_maxMonthlyTapIncreaseRate)`%
     * @param _maxMonthlyTapIncreasePct New maximum monthly tap increase rate
    */
    function updateMaxMonthlyTapIncreasePct(uint256 _maxMonthlyTapIncreasePct) external auth(UPDATE_MONTHLY_TAP_INCREASE_ROLE) {
        tap.updateMaxMonthlyTapIncreasePct(_maxMonthlyTapIncreasePct);
    }

    /**
     * @notice Update tap for `_token.symbol(): string` to the pace of `@tokenAmount(_token, _tap)` per second
     * @param _token Address of the token whose tap is to be updated
     * @param _tap New tap to be applied to the token [in wei / second]
    */
    function updateTokenTap(address _token, uint256 _tap) external auth(UPDATE_TOKEN_TAP_ROLE) {
        tap.updateTokenTap(_token, _tap);
    }

    /**
     * @notice Transfer tap-controlled amount of `_token.symbol(): string` from reserve to beneficiary
     * @param _token Address of the token to be transferred from reserve to beneficiary
    */
    function withdraw(address _token) external auth(WITHDRAW_ROLE) {
        tap.withdraw(_token);
    }

    /* market maker related functions */

    function createBuyOrder(address _collateralToken, uint256 _value) external payable auth(CREATE_BUY_ORDER_ROLE) {
        address(marketMaker).call.value(msg.value)(
            bytes4(keccak256("createBuyOrder(address,address,uint256)")), msg.sender, _collateralToken, _value
        );
    }

    function createSellOrder(address _collateralToken, uint256 _amount) external auth(CREATE_SELL_ORDER_ROLE) {
        marketMaker.createSellOrder(msg.sender, _collateralToken, _amount);
    }

    function clearBatches() external isInitialized {
        marketMaker.clearBatches();
    }

    function claimBuy(address _collateralToken, uint256 _batchId) external isInitialized {
        marketMaker.claimBuy(msg.sender, _collateralToken, _batchId);
    }

    function claimSell(address _collateralToken, uint256 _batchId) external isInitialized {
        marketMaker.claimSell(msg.sender, _collateralToken, _batchId);
    }

    function clearBatchesAndClaimBuy(address _collateralToken, uint256 _batchId) external isInitialized {
        marketMaker.clearBatchesAndClaimBuy(msg.sender, _collateralToken, _batchId);
    }

    function clearBatchesAndClaimSell(address _collateralToken, uint256 _batchId) external isInitialized {
        marketMaker.clearBatchesAndClaimSell(msg.sender, _collateralToken, _batchId);
    }

    /***** public view functions *****/

    function balanceOf(address _who, address _token) public view returns (uint256) {
        uint256 balance = _token == ETH ? _who.balance : ERC20(_token).staticBalanceOf(_who);

        if (_who == address(reserve)) {
            return balance.sub(tap.getMaxWithdrawal(_token));
        } else {
            return balance;
        }
    }
}
