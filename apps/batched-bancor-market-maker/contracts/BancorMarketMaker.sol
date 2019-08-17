/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/apps-vault/contracts/Vault.sol";

import "@ablack/fundraising-interface-core/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-formula-bancor/contracts/BancorFormula.sol";


contract BancorMarketMaker is EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE = keccak256("UPDATE_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_FEES_ROLE = keccak256("UPDATE_FEES_ROLE");
    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");

    uint64 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18
    uint32 public constant PPM = 1000000;

    string private constant ERROR_CONTROLLER_NOT_CONTRACT = "BMM_CONTROLLER_NOT_CONTRACT";
    string private constant ERROR_TM_NOT_CONTRACT = "BMM_TM_NOT_CONTRACT";
    string private constant ERROR_RESERVE_NOT_CONTRACT = "BMM_RESERVE_NOT_CONTRACT";
    string private constant ERROR_FORMULA_NOT_CONTRACT = "BMM_FORMULA_NOT_CONTRACT";
    string private constant ERROR_NOT_CONTRACT = "BMM_NOT_CONTRACT";
    string private constant ERROR_BATCH_BLOCKS_ZERO = "BMM_BATCH_BLOCKS_ZERO";
    string private constant ERROR_FEE_PERCENTAGE_TOO_HIGH = "BMM_FEE_PERCENTAGE_TOO_HIGH";
    string private constant ERROR_COLLATERAL_NOT_WHITELISTED = "BMM_COLLATERAL_NOT_WHITELISTED";
    string private constant ERROR_COLLATERAL_NOT_ETH_OR_ERC20 = "BMM_COLLATERAL_NOT_ETH_OR_ERC20";
    string private constant ERROR_BUY_VALUE_ZERO = "BMM_BUY_VALUE_ZERO";
    string private constant ERROR_SELL_AMOUNT_ZERO = "BMM_SELL_AMOUNT_ZERO";
    string private constant ERROR_INSUFFICIENT_VALUE = "BMM_INSUFFICIENT_VALUE";
    string private constant ERROR_INSUFFICIENT_BALANCE = "BMM_INSUFFICIENT_BALANCE";
    string private constant ERROR_NOTHING_TO_CLAIM = "BMM_NOTHING_TO_CLAIM";
    string private constant ERROR_BATCHES_ALREADY_CLEARED = "BMM_BATCHES_ALREADY_CLEARED";
    string private constant ERROR_BATCH_NOT_CLEARED = "BMM_BATCH_NOT_CLEARED";
    string private constant ERROR_BATCH_NOT_OVER = "BMM_BATCH_NOT_OVER";
    string private constant ERROR_TRANSFER_FROM_FAILED = "BMM_TRANSFER_FROM_FAILED";


    struct Batch {
        bool    initialized;
        bool    cleared;
        uint256 poolBalance;
        uint256 totalSupply;
        uint256 totalBuySpend;
        uint256 totalBuyReturn;
        uint256 totalSellSpend;
        uint256 totalSellReturn;
        mapping(address => uint256) buyers;
        mapping(address => uint256) sellers;
    }

    struct Collateral {
        bool    exists;
        uint256 virtualSupply;
        uint256 virtualBalance;
        uint32  reserveRatio;
        mapping(uint256 => Batch) batches;
    }

    uint256 public waitingClear;
    uint256 public batchBlocks;
    uint256 public buyFeePct;
    uint256 public sellFeePct;

    IMarketMakerController public controller;
    TokenManager           public tokenManager;
    ERC20                  public token;
    Vault                  public reserve;
    address                public beneficiary;
    IBancorFormula         public formula;

    uint256 public collateralTokensLength;
    mapping(uint256 => address) public collateralTokens;
    mapping(address => Collateral) public collateralTokenInfo;

    event AddCollateralToken(address indexed collateralToken, uint256 virtualSupply, uint256 virtualBalance, uint32 reserveRatio);
    event UpdateCollateralToken(address indexed collateralToken, uint256 virtualSupply, uint256 virtualBalance, uint32 reserveRatio);
    event UpdateBeneficiary(address beneficiary);
    event UpdateFees(uint256 buyFee, uint256 sellFee);
    event NewBuyOrder(address indexed buyer, address indexed collateralToken, uint256 value, uint256 batchId);
    event NewSellOrder(address indexed seller, address indexed collateralToken, uint256 amount, uint256 batchId);
    event ClearBatch(address indexed collateralToken, uint256 batchId);
    event ReturnBuy(address indexed buyer, address indexed collateralToken, uint256 amount);
    event ReturnSell(address indexed seller, address indexed collateralToken, uint256 value);

    function initialize(
        IMarketMakerController _controller,
        TokenManager           _tokenManager,
        Vault                  _reserve,
        address                _beneficiary,
        IBancorFormula         _formula,
        uint256                _batchBlocks,
        uint256                _buyFee,
        uint256                _sellFee
    )
        external onlyInit
    {
        initialized();

        require(isContract(_controller), ERROR_CONTROLLER_NOT_CONTRACT);
        require(isContract(_tokenManager), ERROR_TM_NOT_CONTRACT);
        require(isContract(_reserve), ERROR_RESERVE_NOT_CONTRACT);
        require(isContract(_formula), ERROR_FORMULA_NOT_CONTRACT);
        require(_batchBlocks > 0, ERROR_BATCH_BLOCKS_ZERO);
        require(_buyFee < PCT_BASE, ERROR_FEE_PERCENTAGE_TOO_HIGH);
        require(_sellFee < PCT_BASE, ERROR_FEE_PERCENTAGE_TOO_HIGH);

        controller = _controller;
        tokenManager = _tokenManager;
        token = ERC20(tokenManager.token());
        reserve = _reserve;
        beneficiary = _beneficiary;
        formula = _formula;
        batchBlocks = _batchBlocks;
        buyFeePct = _buyFee;
        sellFeePct = _sellFee;
    }

    /***** external functions *****/

    /**
      * @notice Add `_collateralToken.symbol(): string` as a whitelisted collateral
      * @param _collateralToken The address of the collateral token to be added
      * @param _virtualSupply The virtual supply to be used for that collateral token
      * @param _virtualBalance The virtual balance to be used for that collateral token
      * @param _reserveRatio The reserve ratio to be used for that collateral token [in PPM]
    */
    function addCollateralToken(
        address _collateralToken,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32 _reserveRatio
    )
        external auth(ADD_COLLATERAL_TOKEN_ROLE)
    {
        require(!collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_collateralToken == ETH || isContract(_collateralToken), ERROR_COLLATERAL_NOT_ETH_OR_ERC20);

        _addCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    /**
     * @notice Update `_collateralToken.symbol(): string` collateral settings
     * @param _collateralToken The address of the collateral token whose settings are to be updated
     * @param _virtualSupply The new virtual supply to be used for that collateral token
     * @param _virtualBalance The new virtual balance to be used for that collateral token
     * @param _reserveRatio The new reserve ratio to be used for that collateral token [in PPM]
    */
    function updateCollateralToken(
        address _collateralToken,
        uint256 _virtualSupply,
        uint256 _virtualBalance,
        uint32 _reserveRatio
    )
        external auth(UPDATE_COLLATERAL_TOKEN_ROLE)
    {
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);

        _updateCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    /**
     * @notice Update the beneficiary to `_beneficiary`
     * @param _beneficiary The new beneficiary to be used
    */
    function updateBeneficiary(address _beneficiary) external auth(UPDATE_BENEFICIARY_ROLE) {
        _updateBeneficiary(_beneficiary);
    }

    /**
     * @notice Update the fee percentage deducted from all buy and sell orders to respectively `@formatPct(_buyFee)` % and `@formatPct(_sellFee)` %
     * @param _buyFee The new buy fee to be used
     * @param _sellFee The new sell fee to be used
    */
    function updateFees(uint256 _buyFee, uint256 _sellFee) external auth(UPDATE_FEES_ROLE) {
        require(_buyFee < PCT_BASE, ERROR_FEE_PERCENTAGE_TOO_HIGH);
        require(_sellFee < PCT_BASE, ERROR_FEE_PERCENTAGE_TOO_HIGH);

        _updateFees(_buyFee, _sellFee);
    }

    /**
     * @dev    Create a buy order into the current batch. NOTICE: totalSupply and balance remain the same [although collateral has been collected and is being held by the pool].
     * @notice Create a buy order worth `@tokenAmount(_collateralToken, _value)`
     * @param _buyer The address of the buyer
     * @param _collateralToken The address of the collateral token to be spent
     * @param _value The amount of collateral token to be spent
    */
    function createBuyOrder(address _buyer, address _collateralToken, uint256 _value) external payable auth(CREATE_BUY_ORDER_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_value != 0, ERROR_BUY_VALUE_ZERO);
        if (_collateralToken == ETH) {
            require(msg.value >= _value, ERROR_INSUFFICIENT_VALUE);
        }

        _createBuyOrder(_buyer, _collateralToken, _value);
    }

    /**
     * @dev    Create a sell order into the current batch. NOTICE: totalSupply is decremented but balance and pool balance remain the same.
     * @notice Create a sell order worth `@tokenAmount(token, _amount)`
     * @param _seller The address of the seller
     * @param _collateralToken The address of the collateral token to be returned
     * @param _amount The amount of bonded token to be spent
    */
    function createSellOrder(address _seller, address _collateralToken, uint256 _amount) external auth(CREATE_SELL_ORDER_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);
        require(_amount != 0, ERROR_SELL_AMOUNT_ZERO);
        require(token.staticBalanceOf(_seller) >= _amount, ERROR_INSUFFICIENT_BALANCE);

        _createSellOrder(_seller, _collateralToken, _amount);
    }

    /**
     * @notice Clear the last batches of orders [if they have not yet been cleared]
    */
    function clearBatches() external isInitialized {
        require(waitingClear != 0, ERROR_BATCHES_ALREADY_CLEARED); // require that batch has not yet been cleared
        require(waitingClear < getCurrentBatchId(), ERROR_BATCH_NOT_OVER); // require current batch to be over

        _clearBatches();
    }

    /**
     * @notice Return the results of `_buyer`'s buy orders through `_collateralToken.symbol(): string` collateral from batch #`_batchId`
     * @param _buyer The address of the user whose buy results are to be returned
     * @param _collateralToken The address of the collateral token used
     * @param _batchId The id of the batch used
    */
    function claimBuy(address _buyer, address _collateralToken, uint256 _batchId) external isInitialized {
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        require(batch.cleared, ERROR_BATCH_NOT_CLEARED);
        require(batch.buyers[_buyer] != 0, ERROR_NOTHING_TO_CLAIM);

        _claimBuy(_buyer, _collateralToken, _batchId);
    }

    /**
     * @notice Return the results of `_seller`'s `_collateralToken.symbol(): string` sell orders from batch #`_batchId`
     * @param _seller The address of the user whose sale results are to be returned
     * @param _collateralToken The address of the collateral token used
     * @param _batchId The id of the batch used
    */
    function claimSell(address _seller, address _collateralToken, uint256 _batchId) external isInitialized {
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        require(batch.cleared, ERROR_BATCH_NOT_CLEARED);
        require(batch.sellers[_seller] != 0, ERROR_NOTHING_TO_CLAIM);

        _claimSell(_seller, _collateralToken, _batchId);
    }

    /**
     * @notice Clear the last batches of orders and return the results of `_buyer`'s buy orders through `_collateralToken.symbol(): string` collateral from last batch
     * @param _buyer The address of the user whose buy results are to be returned
     * @param _collateralToken The address of the collateral token used
     * @param _batchId The id of the batch used
    */
    function clearBatchesAndClaimBuy(address _buyer, address _collateralToken, uint256 _batchId) external isInitialized {
        require(waitingClear < getCurrentBatchId(), ERROR_BATCH_NOT_OVER);
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);

        if (waitingClear == _batchId)
            _clearBatches();

        _claimBuy(_buyer, _collateralToken, _batchId);
    }

    /**
     * @notice Clear the last batches of orders and return the results of `_seller`'s `_collateralToken.symbol(): string` sell orders from last batch
     * @param _seller The address of the user whose sale results are to be returned
     * @param _collateralToken The address of the collateral token used
     * @param _batchId The id of the batch used
    */
    function clearBatchesAndClaimSell(address _seller, address _collateralToken, uint256 _batchId) external isInitialized {
        require(waitingClear < getCurrentBatchId(), ERROR_BATCH_NOT_OVER);
        require(collateralTokenInfo[_collateralToken].exists, ERROR_COLLATERAL_NOT_WHITELISTED);

        if (waitingClear == _batchId)
            _clearBatches();

        _claimSell(_seller, _collateralToken, _batchId);
    }

    /***** public view functions *****/

    /**
     * @dev Get the id [i.e. block number] attached to the current batches of orders
     * @return The id the current batches of orders
    */
    function getCurrentBatchId() public view isInitialized returns (uint256) {
        return (block.number.div(batchBlocks)).mul(batchBlocks);
    }

    function getBatch(address _collateralToken, uint256 _batchId)
        public
        view
        isInitialized
        returns (bool, bool, uint256, uint256, uint256, uint256, uint256, uint256)
    {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];

        return (
            batch.initialized,
            batch.cleared,
            batch.poolBalance,
            batch.totalSupply,
            batch.totalBuySpend,
            batch.totalBuyReturn,
            batch.totalSellSpend,
            batch.totalSellReturn
        );
    }

    function getCollateralTokenInfo(address _collateralToken) public view isInitialized returns (bool, uint256, uint256, uint32) {
        Collateral storage collateral = collateralTokenInfo[_collateralToken];

        return (collateral.exists, collateral.virtualSupply, collateral.virtualBalance, collateral.reserveRatio);
    }

    /**
     * @dev Get the current exact price [with no slippage] of the token with respect to a specific collateral token [returned as parts per million for precision].
     *      price = collateral / (tokenSupply * CW)
     *      price = collateral / (tokenSupply * (CW / PPM)
     *      price = (collateral * PPM) / (tokenSupply * CW)
     * @param _collateralToken The address of the collateral token to be used in the calculation
     * @param _totalSupply The token supply to be used in the calculation
     * @param _poolBalance The collateral pool balance to be used in the calculation
     * @return The current exact price in parts per million as collateral over token
    */
    function getPricePPM(
        address _collateralToken,
        uint256 _totalSupply,
        uint256 _poolBalance
    )
        public view isInitialized
        returns (uint256 price)
    {
        price = uint256(PPM).mul(
            _poolBalance.add(
                collateralTokenInfo[_collateralToken].virtualBalance)
            ).div(
                (_totalSupply.add(collateralTokenInfo[_collateralToken].virtualSupply)
            ).mul(collateralTokenInfo[_collateralToken].reserveRatio)
        );

        if (price == 0)
            price = 1;
    }

    /**
     * @dev Get the estimate result of a purchase in the scenario that it were the only order within the current batch or orders
     * @param _collateralToken The address of the collateral token te be used in the calculation
     * @param _totalSupply The token supply to be used in the calculation
     * @param _poolBalance The collateral pool balance to be used in the calculation
     * @param _buyValue The amount of collateral tokens to be spent in the purchase
     * @return The number of tokens that would be purchased in this scenario
    */
    function getBuy(
        address _collateralToken,
        uint256 _totalSupply,
        uint256 _poolBalance,
        uint256 _buyValue
    )
        public view isInitialized
        returns (uint256)
    {
        return formula.calculatePurchaseReturn(
            _totalSupply.add(collateralTokenInfo[_collateralToken].virtualSupply),
            _poolBalance.add(collateralTokenInfo[_collateralToken].virtualBalance),
            collateralTokenInfo[_collateralToken].reserveRatio,
            _buyValue
        );
    }

    /**
     * @dev Get the estimate result of a sale of tokens in the scenario that it were the only order within the current batch of orders
     * @param _collateralToken The address of the collateral token to be used in the calculation
     * @param _totalSupply The token supply to be used in the calculation
     * @param _poolBalance The collateral pool balance to be used in the calculation
     * @param _sellAmount The amount of tokens to be sold in the transaction
     * @return The number of collateral tokens that would be returned in this scenario
    */
    function getSell(
        address _collateralToken,
        uint256 _totalSupply,
        uint256 _poolBalance,
        uint256 _sellAmount
    )
        public view isInitialized
        returns (uint256)
    {
        return formula.calculateSaleReturn(
            _totalSupply.add(collateralTokenInfo[_collateralToken].virtualSupply),
            _poolBalance.add(collateralTokenInfo[_collateralToken].virtualBalance),
            collateralTokenInfo[_collateralToken].reserveRatio,
            _sellAmount
        );
    }

    /***** internal functions *****/

    function _getInitializedBatch(address _collateralToken) internal returns (uint256, Batch storage) {
        uint256 batchId = getCurrentBatchId();
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[batchId];

        if (!batch.initialized) {
            // clear previous batch
            _clearBatches();
            // initialize new batch
            for (uint i = 0; i < collateralTokensLength; i++) {
                address collateralToken = collateralTokens[i];
                collateralTokenInfo[collateralToken].batches[batchId].poolBalance = controller.balanceOf(address(reserve), collateralToken);
                collateralTokenInfo[collateralToken].batches[batchId].totalSupply = token.totalSupply();
                collateralTokenInfo[collateralToken].batches[batchId].initialized = true;
            }
            // reset waitingClear;
            waitingClear = batchId;
        }

        return (batchId, batch);
    }

    function _addCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) internal {
        collateralTokens[collateralTokensLength] = _collateralToken;
        collateralTokenInfo[_collateralToken].exists = true;
        collateralTokenInfo[_collateralToken].virtualSupply = _virtualSupply;
        collateralTokenInfo[_collateralToken].virtualBalance = _virtualBalance;
        collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;
        collateralTokensLength = collateralTokensLength + 1;

        emit AddCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    function _updateCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) internal {
        collateralTokenInfo[_collateralToken].virtualSupply = _virtualSupply;
        collateralTokenInfo[_collateralToken].virtualBalance = _virtualBalance;
        collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;

        emit UpdateCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    function _updateBeneficiary(address _beneficiary) internal {
        beneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    function _updateFees(uint256 _buyFee, uint256 _sellFee) internal {
        buyFeePct = _buyFee;
        sellFeePct = _sellFee;

        emit UpdateFees(_buyFee, _sellFee);
    }

    function _createBuyOrder(address _buyer, address _collateralToken, uint256 _value) internal {
        (uint256 batchId, Batch storage batch) = _getInitializedBatch(_collateralToken);

        uint256 fee = _value.mul(buyFeePct).div(PCT_BASE);
        uint256 valueAfterFee = _value.sub(fee);

        _transfer(_buyer, address(reserve), _collateralToken, valueAfterFee);
        if (fee > 0)
            _transfer(_buyer, beneficiary, _collateralToken, fee);

        batch.totalBuySpend = batch.totalBuySpend.add(valueAfterFee);
        batch.buyers[_buyer] = batch.buyers[_buyer].add(valueAfterFee);

        emit NewBuyOrder(_buyer, _collateralToken, valueAfterFee, batchId);
    }

    function _createSellOrder(address _seller, address _collateralToken, uint256 _amount) internal {
        (uint256 batchId, Batch storage batch) = _getInitializedBatch(_collateralToken);

        tokenManager.burn(_seller, _amount);

        batch.totalSellSpend = batch.totalSellSpend.add(_amount);
        batch.sellers[_seller] = batch.sellers[_seller].add(_amount);

        emit NewSellOrder(_seller, _collateralToken, _amount, batchId);
    }

    function _clearBatches() internal {
        for (uint256 i = 0; i < collateralTokensLength; i++) {
            _clearBatch(collateralTokens[i]);
        }

        waitingClear = 0;
    }

    function _clearBatch(address _collateralToken) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[waitingClear];

        if (waitingClear == 0)
            return;

        if (batch.cleared)
            return;

        _clearMatching(_collateralToken);

        // sell orders already burned their bonded tokens
        // now buy orders bonded tokens need to be minted
        // the resulting tokens are held by the pool contract until collected by the buyers
        if (batch.totalBuyReturn > 0)
            tokenManager.mint(address(reserve), batch.totalBuyReturn);

        batch.cleared = true;

        emit ClearBatch(_collateralToken, waitingClear);
    }

    function _clearMatching(address collateralToken) internal {
        Batch storage batch = collateralTokenInfo[collateralToken].batches[waitingClear]; // clearing batch

        // do nothing if there are no orders
        if (batch.totalSellSpend == 0 && batch.totalBuySpend == 0)
            return;

        // the static price is the current exact price in collateral
        // per token according to the initial state of the batch
        uint256 staticPrice = getPricePPM(collateralToken, batch.totalSupply, batch.poolBalance);

        // We want to find out if there are more buy orders or more sell orders.
        // To do this we check the result of all sells and all buys at the current
        // exact price. If the result of sells is larger than the pending buys, there are more sells.
        // If the result of buys is larger than the pending sells, there are more buys.
        // Of course we don't really need to check both, if one is true then the other is false.
        uint256 resultOfSell = batch.totalSellSpend.mul(staticPrice).div(PPM);

        // We check if the result of the sells was more than the bending buys to determine
        // if there were more sells than buys. If that is the case we will execute all pending buy
        // orders at the current exact price, because there is at least one sell order for each buy.
        // The remaining sell orders will be executed using the traditional bonding curve.
        // The final sell price will be a combination of the exact price and the bonding curve price.
        // Further down we will do the opposite if there are more buys than sells.

        // if more sells than buys
        if (resultOfSell >= batch.totalBuySpend) {
            // totalBuyReturn is the number of tokens bought as a result of all buy orders combined at the
            // current exact price. We have already determined that this number is less than the
            // total amount of tokens to be sold.
            // tokens = totalBuySpend / staticPrice. staticPrice is in PPM, to avoid
            // rounding errors it has been re-arranged with PPM as a numerator
            batch.totalBuyReturn = batch.totalBuySpend.mul(PPM).div(staticPrice); // tokens

            // we know there should be some tokens left over to be sold with the curve.
            // these should be the difference between the original total sell order
            // and the result of executing all of the buys.
            uint256 remainingSell = batch.totalSellSpend.sub(batch.totalBuyReturn); // tokens

            // now that we know how many tokens are left to be sold we can get the amount of collateral
            // generated by selling them through a normal bonding curve execution, based on the
            // original totalSupply and poolBalance (as if the buy orders never existed and the sell
            // order was just smaller than originally thought).
            uint256 remainingSellReturn = getSell(collateralToken, batch.totalSupply, batch.poolBalance, remainingSell);

            // the total result of all sells is the original amount of buys which were matched, plus the remaining
            // sells which were executed with the bonding curve
            batch.totalSellReturn = batch.totalBuySpend.add(remainingSellReturn);


        // more buys than sells
        } else {

            // Now in this scenario there were more buys than sells. That means that resultOfSell that we
            // calculated earlier is the total result of sell.
            batch.totalSellReturn = resultOfSell;

            // there is some collateral left over to be spent as buy orders. this should be the difference between
            // the original total buy order, and the result of executing all of the sells.
            uint256 remainingBuy = batch.totalBuySpend.sub(resultOfSell);

            // now that we know how much collateral is left to be spent we can get the amount of tokens
            // generated by spending it through a normal bonding curve execution, based on the
            // original totalSupply and poolBalance (as if the sell orders never existed and the buy
            // order was just smaller than originally thought).
            uint256 remainingBuyReturn = getBuy(collateralToken, batch.totalSupply, batch.poolBalance, remainingBuy);

            // remainingBuyReturn becomes the combintation of all the sell orders
            // plus the resulting tokens from the remaining buy orders
            batch.totalBuyReturn = batch.totalSellSpend.add(remainingBuyReturn);
        }
    }

    function _claimBuy(address _buyer, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        uint256 buyReturn = (batch.buyers[_buyer].mul(batch.totalBuyReturn)).div(batch.totalBuySpend);

        batch.buyers[_buyer] = 0;

        if (buyReturn > 0) {
            tokenManager.burn(address(reserve), buyReturn);
            tokenManager.mint(_buyer, buyReturn);
        }

        emit ReturnBuy(_buyer, _collateralToken, buyReturn);
    }

    function _claimSell(address _seller, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        uint256 sellReturn = (batch.sellers[_seller].mul(batch.totalSellReturn)).div(batch.totalSellSpend);
        uint256 fee = sellReturn.mul(sellFeePct).div(PCT_BASE);
        uint256 amountAfterFee = sellReturn.sub(fee);

        batch.sellers[_seller] = 0;

        if (amountAfterFee > 0) {
            reserve.transfer(_collateralToken, _seller, amountAfterFee);
        }
        if (fee > 0) {
            reserve.transfer(_collateralToken, beneficiary, fee);
        }

        emit ReturnSell(_seller, _collateralToken, amountAfterFee);
    }

    function _transfer(address _from, address _to, address _collateralToken, uint256 _amount) internal {
        if (_collateralToken == ETH) {
            _to.transfer(_amount);
        } else {
            require(ERC20(_collateralToken).safeTransferFrom(_from, _to, _amount), ERROR_TRANSFER_FROM_FAILED);
        }
    }
}
