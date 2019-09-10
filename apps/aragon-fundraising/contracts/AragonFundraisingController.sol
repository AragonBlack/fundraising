pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/apps-agent/contracts/Agent.sol";
import "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";
import "@ablack/fundraising-presale/contracts/Presale.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";
import "@ablack/fundraising-shared-interfaces/contracts/IAragonFundraisingController.sol";


contract AragonFundraisingController is EtherTokenConstant, IsContract, IAragonFundraisingController, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath  for uint256;

    bytes32 public constant UPDATE_BENEFICIARY_ROLE                   = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_FEES_ROLE                          = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE                 = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant REMOVE_COLLATERAL_TOKEN_ROLE              = keccak256("REMOVE_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE              = keccak256("UPDATE_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE = keccak256("UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE                     = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant RESET_TOKEN_TAP_ROLE                      = keccak256("RESET_TOKEN_TAP_ROLE");
    bytes32 public constant OPEN_PRESALE_ROLE                         = keccak256("OPEN_PRESALE_ROLE");
    bytes32 public constant OPEN_TRADING_ROLE                         = keccak256("OPEN_TRADING_ROLE");
    bytes32 public constant CONTRIBUTE_ROLE                           = keccak256("CONTRIBUTE_ROLE");
    bytes32 public constant OPEN_BUY_ORDER_ROLE                       = keccak256("OPEN_BUY_ORDER_ROLE");
    bytes32 public constant OPEN_SELL_ORDER_ROLE                      = keccak256("OPEN_SELL_ORDER_ROLE");
    bytes32 public constant WITHDRAW_ROLE                             = keccak256("WITHDRAW_ROLE");

    string private constant ERROR_CONTRACT_IS_EOA = "FUNDRAISING_CONTRACT_IS_EOA";

    Presale                  public presale;
    BatchedBancorMarketMaker public marketMaker;
    Agent                    public reserve;
    Tap                      public tap;


    /***** external functions *****/

    /**
     * @notice Initialize Aragon Fundraising controller
     * @param _presale     The address of the presale contract
     * @param _marketMaker The address of the market maker contract
     * @param _reserve     The address of the reserve [pool] contract
     * @param _tap         The address of the tap contract
    */
    function initialize(Presale _presale, BatchedBancorMarketMaker _marketMaker, Agent _reserve, Tap _tap) external onlyInit {
        require(isContract(_presale),     ERROR_CONTRACT_IS_EOA);
        require(isContract(_marketMaker), ERROR_CONTRACT_IS_EOA);
        require(isContract(_reserve),     ERROR_CONTRACT_IS_EOA);
        require(isContract(_tap),         ERROR_CONTRACT_IS_EOA);

        initialized();

        presale = _presale;
        marketMaker = _marketMaker;
        reserve = _reserve;
        tap = _tap;
    }

    /* generic settings related function */

    /**
     * @notice Update beneficiary to `_beneficiary`
     * @param _beneficiary The address of the new beneficiary
    */
    function updateBeneficiary(address _beneficiary) external auth(UPDATE_BENEFICIARY_ROLE) {
        marketMaker.updateBeneficiary(_beneficiary);
        tap.updateBeneficiary(_beneficiary);
    }

    /**
     * @notice Update fees deducted from buy and sell orders to respectively `@formatPct(_buyFeePct)`% and `@formatPct(_sellFeePct)`%
     * @param _buyFeePct  The new fee to be deducted from buy orders [in PCT_BASE]
     * @param _sellFeePct The new fee to be deducted from sell orders [in PCT_BASE]
    */
    function updateFees(uint256 _buyFeePct, uint256 _sellFeePct) external auth(UPDATE_FEES_ROLE) {
        marketMaker.updateFees(_buyFeePct, _sellFeePct);
    }

    /* presale related functions */

    /**
     * @notice Open presale
    */
    function openPresale() external auth(OPEN_PRESALE_ROLE) {
        presale.open();
    }

    /**
     * @notice Close presale and open fundraising campaign
    */
    function closePresale() external isInitialized {
        presale.close();
    }

    /**
     * @notice Contribute to the presale up to `@tokenAmount(self.contributionToken(): address, _value)`
     * @param _value The amount of contribution token to be spent
    */
    function contribute(uint256 _value) external payable auth(CONTRIBUTE_ROLE) {
        presale.contribute.value(msg.value)(msg.sender, _value);
    }

    /**
     * @notice Refund `_buyer`'s presale contribution #`_vestedPurchaseId`
     * @param _buyer            The address of the user whose presale contribution is to be refunded
     * @param _vestedPurchaseId The id of the contribution to be refunded

    */
    function refund(address _buyer, uint256 _vestedPurchaseId) external isInitialized {
        presale.refund(_buyer, _vestedPurchaseId);
    }

    /* market making related functions */

    /**
     * @notice Open trading [enabling users to open buy and sell orders]
    */
    function openTrading() external auth(OPEN_TRADING_ROLE) {
        marketMaker.open();
    }

    /**
     * @notice Open a buy order worth `@tokenAmount(_collateral, _value)`
     * @param _collateral The address of the collateral token to be spent
     * @param _value      The amount of collateral token to be spent
    */
    function openBuyOrder(address _collateral, uint256 _value) external payable auth(OPEN_BUY_ORDER_ROLE) {
        marketMaker.openBuyOrder.value(msg.value)(msg.sender, _collateral, _value);
    }

    /**
     * @notice Open a sell order worth `@tokenAmount(self.token(): address, _amount)` against `_collateral.symbol(): string`
     * @param _collateral The address of the collateral token to be returned
     * @param _amount     The amount of bonded token to be spent
    */
    function openSellOrder(address _collateral, uint256 _amount) external auth(OPEN_SELL_ORDER_ROLE) {
        marketMaker.openSellOrder(msg.sender, _collateral, _amount);
    }

    /**
     * @notice Claim the results of `_collateral.symbol(): string` buy orders from batch #`_batchId`
     * @param _buyer      The address of the user whose buy orders are to be claimed
     * @param _batchId    The id of the batch in which buy orders are to be claimed
     * @param _collateral The address of the collateral token against which buy orders are to be claimed
    */
    function claimBuyOrder(address _buyer, uint256 _batchId, address _collateral) external isInitialized {
        marketMaker.claimBuyOrder(_buyer, _batchId, _collateral);
    }

    /**
     * @notice Claim the results of `_collateral.symbol(): string` sell orders from batch #`_batchId`
     * @param _seller     The address of the user whose sell orders are to be claimed
     * @param _batchId    The id of the batch in which sell orders are to be claimed
     * @param _collateral The address of the collateral token against which sell orders are to be claimed
    */
    function claimSellOrder(address _seller, uint256 _batchId, address _collateral) external isInitialized {
        marketMaker.claimSellOrder(_seller, _batchId, _collateral);
    }

    /* collateral tokens related functions */

    /**
     * @notice Add `_collateral.symbol(): string` as a whitelisted collateral token
     * @param _collateral     The address of the collateral token to be whitelisted
     * @param _virtualSupply  The virtual supply to be used for that collateral token [in wei]
     * @param _virtualBalance The virtual balance to be used for that collateral token [in wei]
     * @param _reserveRatio   The reserve ratio to be used for that collateral token [in PPM]
     * @param _slippage       The price slippage below which each market making batch is to be kept for that collateral token [in PCT_BASE]
     * @param _rate           The rate at which that token is to be tapped [in wei / block]
     * @param _floor          The floor above which the reserve [pool] balance for that token is to be kept [in wei]
    */
    function addCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32  _reserveRatio,
        uint256 _slippage,
        uint256 _rate,
        uint256 _floor
    )
    	external
        auth(ADD_COLLATERAL_TOKEN_ROLE)
    {
        marketMaker.addCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
        tap.addTappedToken(_collateral, _rate, _floor);
        if (_collateral != ETH) {
            reserve.addProtectedToken(_collateral);
        }
    }

    /**
      * @notice Remove `_collateral.symbol(): string` as a whitelisted collateral token
      * @param _collateral The address of the collateral token to be un-whitelisted
    */
    function removeCollateralToken(address _collateral) external auth(REMOVE_COLLATERAL_TOKEN_ROLE) {
        marketMaker.removeCollateralToken(_collateral);
        // the token should still be tapped to avoid being locked
        // the token should still be protected to avoid being spent
    }

    /**
     * @notice Update `_collateral.symbol(): string` collateralization settings
     * @param _collateral     The address of the collateral token whose collateralization settings are to be updated
     * @param _virtualSupply  The new virtual supply to be used for that collateral token [in wei]
     * @param _virtualBalance The new virtual balance to be used for that collateral token [in wei]
     * @param _reserveRatio   The new reserve ratio to be used for that collateral token [in PPM]
     * @param _slippage       The new price slippage below which each market making batch is to be kept for that collateral token [in PCT_BASE]
    */
    function updateCollateralToken(
        address _collateral,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32  _reserveRatio,
        uint256 _slippage
    )
        external
        auth(UPDATE_COLLATERAL_TOKEN_ROLE)
    {
        marketMaker.updateCollateralToken(_collateral, _virtualSupply, _virtualBalance, _reserveRatio, _slippage);
    }

    /* tap related functions */

    /**
     * @notice Update maximum tap rate increase percentage to `@formatPct(_maximumTapRateIncreasePct)`%
     * @param _maximumTapRateIncreasePct The new maximum tap rate increase percentage to be allowed [in PCT_BASE]
    */
    function updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) external auth(UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE) {
        tap.updateMaximumTapRateIncreasePct(_maximumTapRateIncreasePct);
    }

    /**
     * @notice Update tap for `_token.symbol(): string` with a rate of `@tokenAmount(_token, _rate)` per block and a floor of `@tokenAmount(_token, _floor)`
     * @param _token The address of the token whose tap is to be updated
     * @param _rate  The new rate at which that token is to be tapped [in wei / block]
     * @param _floor The new floor above which the reserve [pool] balance for that token is to be kept [in wei]
    */
    function updateTokenTap(address _token, uint256 _rate, uint256 _floor) external auth(UPDATE_TOKEN_TAP_ROLE) {
        tap.updateTappedToken(_token, _rate, _floor);
    }

    /**
     * @notice Reset tap timestamps for `_token.symbol(): string`
     * @param _token The address of the token whose tap timestamps are to be reset
    */
    function resetTokenTap(address _token) external auth(RESET_TOKEN_TAP_ROLE) {
        tap.resetTappedToken(_token);
    }

    /**
     * @notice Transfer about `@tokenAmount(_token, self.getMaximumWithdrawal(_token): uint256)` from the reserve to the beneficiary
     * @param _token The address of the token to be transfered from the reserve to the beneficiary
    */
    function withdraw(address _token) external auth(WITHDRAW_ROLE) {
        tap.withdraw(_token);
    }

    /***** public view functions *****/

    function token() public view isInitialized returns (address) {
        return marketMaker.token();
    }

    function contributionToken() public view isInitialized returns (address) {
        return presale.contributionToken();
    }

    function getMaximumWithdrawal(address _token) public view isInitialized returns (uint256) {
        return tap.getMaximumWithdrawal(_token);
    }

    function collateralsToBeClaimed(address _collateral) public view isInitialized returns (uint256) {
        return marketMaker.collateralsToBeClaimed(_collateral);
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
