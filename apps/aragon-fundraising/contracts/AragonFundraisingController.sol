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
import "@ablack/fundraising-shared-interfaces/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";
import "@aragon/apps-agent/contracts/Agent.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";


contract AragonFundraisingController is EtherTokenConstant, IsContract, IMarketMakerController, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE = keccak256("UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE");
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant REMOVE_COLLATERAL_TOKEN_ROLE = keccak256("REMOVE_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE = keccak256("UPDATE_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant OPEN_BUY_ORDER_ROLE = keccak256("OPEN_BUY_ORDER_ROLE");
    bytes32 public constant OPEN_SELL_ORDER_ROLE = keccak256("OPEN_SELL_ORDER_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    string private constant ERROR_CONTRACT_IS_EOA = "FUNDRAISING_CONTRACT_IS_EOA";

    BatchedBancorMarketMaker public marketMaker;
    Agent                    public reserve;
    Tap                      public tap;

    /***** external functions *****/

    function initialize(BatchedBancorMarketMaker _marketMaker, Agent _reserve, Tap _tap) external onlyInit {
        initialized();

        require(isContract(_marketMaker), ERROR_CONTRACT_IS_EOA);
        require(isContract(_reserve), ERROR_CONTRACT_IS_EOA);
        require(isContract(_tap), ERROR_CONTRACT_IS_EOA);

        marketMaker = _marketMaker;
        reserve = _reserve;
        tap = _tap;
    }

    /**
     * @notice Update beneficiary to `_beneficiary`
     * @param _beneficiary The address of the new beneficiary to be used
    */
    function updateBeneficiary(address _beneficiary) external auth(UPDATE_BENEFICIARY_ROLE) {
        marketMaker.updateBeneficiary(_beneficiary);
        tap.updateBeneficiary(_beneficiary);
    }

    /**
     * @notice Update the fee percentage deducted from all buy and sell orders to respectively `@formatPct(_buyFee)` % and `@formatPct(_sellFee)` %
     * @param _buyFee The new buy fee to be used
     * @param _sellFee The new sell fee to be used
    */
    function updateFees(uint256 _buyFee, uint256 _sellFee) external auth(UPDATE_FEES_ROLE) {
        marketMaker.updateFees(_buyFee, _sellFee);
    }

    /**
     * @notice Update maximum tap increase percentage to `@formatPct(_maximumTapIncreasePct)`%
     * @param _maximumTapIncreasePct The new maximum tap increase percentage to be used
    */
    function updateMaximumTapIncreasePct(uint256 _maximumTapIncreasePct) external auth(UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE) {
        tap.updateMaximumTapIncreasePct(_maximumTapIncreasePct);
    }

    /**
     * @notice Add `_token.symbol(): string` as a whitelisted collateral token
     * @param _token The address of the collateral token to be added
     * @param _virtualSupply The virtual supply to be used for that collateral token
     * @param _virtualBalance The virtual balance to be used for that collateral token
     * @param _reserveRatio The reserve ratio to be used for that collateral token [in PPM]
     * @param _tap The tap to be applied applied to that token [in wei / second]
    */
    function addCollateralToken
    (
        address _token,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32 _reserveRatio,
        uint256 _slippage,
        uint256 _tap,
        uint256 _floor
    )
    	external auth(ADD_COLLATERAL_TOKEN_ROLE)
    {
        marketMaker.addCollateralToken(_token, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
        tap.addTappedToken(_token, _tap, _floor);
        if (_token != ETH) {
            reserve.addProtectedToken(_token);
        }
    }

    function removeCollateralToken(address _token) external auth(REMOVE_COLLATERAL_TOKEN_ROLE) {
        marketMaker.removeCollateralToken(_token);
        // the token should still be tapped to avoid being locked
        // the token should still be protected to avoid being spent
    }

    /**
     * @notice Update `_collateral.symbol(): string` collateralization settings
     * @param _collateral The address of the collateral token whose collateralization settings are to be updated
     * @param _virtualSupply The new virtual supply to be used for that collateral token
     * @param _virtualBalance The new virtual balance to be used for that collateral token
     * @param _reserveRatio The new reserve ratio to be used for that collateral token [in PPM]
     * @param _slippage The new maximum price slippage per batch to be allowed for that collateral token [in PCT_BASE]
    */
    function updateCollateralToken(address _collateral, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio, uint256 _slippage)
        external auth(UPDATE_COLLATERAL_TOKEN_ROLE)
    {
        marketMaker.updateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    /**
     * @notice Update tap for `_token.symbol(): string` to the pace of `@tokenAmount(_token, _tap)` per second
     * @param _token Address of the token whose tap is to be updated
     * @param _tap New tap to be applied to the token [in wei / second]
    */
    function updateTokenTap(address _token, uint256 _tap, uint256 _floor) external auth(UPDATE_TOKEN_TAP_ROLE) {
        tap.updateTappedToken(_token, _tap, _floor);
    }

    /**
     * @notice Transfer about `@tokenAmount(_token, self.tap().getMaximalWithdrawal(_token))` from `self.tap().reserve()` to `self.tap().beneficiary()`
     * @param _token The address of the token to be transfered from reserve to beneficiary
    */
    function withdraw(address _token) external auth(WITHDRAW_ROLE) {
        tap.withdraw(_token);
    }

    function openBuyOrder(address _collateral, uint256 _value) external payable auth(OPEN_BUY_ORDER_ROLE) {
        marketMaker.openBuyOrder.value(msg.value)(msg.sender, _collateral, _value);
    }

    function openSellOrder(address _collateral, uint256 _amount) external auth(OPEN_SELL_ORDER_ROLE) {
        marketMaker.openSellOrder(msg.sender, _collateral, _amount);
    }

    function claimBuyOrder(uint256 _batchId, address _collateral) external isInitialized {
        marketMaker.claimBuyOrder(msg.sender, _batchId, _collateral);
    }

    function claimSellOrder(uint256 _batchId, address _collateral) external isInitialized {
        marketMaker.claimSellOrder(msg.sender, _batchId, _collateral);
    }

    /***** public view functions *****/

    function tokensToHold(address _token) public view isInitialized returns (uint256) {
        return marketMaker.collateralsToBeClaimed(_token);
    }

    function balanceOf(address _who, address _token) public view isInitialized returns (uint256) {
        uint256 balance = _token == ETH ? _who.balance : ERC20(_token).staticBalanceOf(_who);

        if (_who == address(reserve)) {
            return balance.sub(tap.getMaximumWithdrawal(_token));
        } else {
            return balance;
        }
    }
}
