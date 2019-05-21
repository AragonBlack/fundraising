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

contract BondingCurve is EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO_ROLE = keccak256("UPDATE_RESERVE_RATIO_ROLE");
    bytes32 public constant UPDATE_FEE_ROLE = keccak256("UPDATE_FEE_ROLE");
    bytes32 public constant UPDATE_GAS_COST_ROLE = keccak256("UPDATE_GAS_COST_ROLE");
    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");

    uint32 private constant PPM  = 1000000;

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
    uint256 public gasCostBuyOrder;
    uint256 public gasCostSellOrder;
    uint256 public feePercentPPM; // 100,000,000 = 100% / 1,000,000 = 1%

    IMarketMakerController public controller;
    TokenManager           public tokenManager;
    ERC20                  public token;
    Vault                  public pool;
    address                public beneficiary;
    IBancorFormula         public formula;

    uint256 public collateralTokensLength;
    mapping(uint256 => address) public collateralTokens;
    mapping(address => Collateral) public collateralTokenInfo;

    event AddCollateralToken(address indexed collateralToken, uint256 virtualSupply, uint256 virtualBalance, uint32 reserveRatio);
    event UpdateReserveRatio(address indexed collateralToken, uint32 reserveRatio);
    event UpdateFee(uint256 fee);
    event UpdateGasCost(uint256 gasCostBuyOrder, uint256 gasCostSellOrder);
    event NewBuyOrder(address indexed buyer, address indexed collateralToken, uint256 value, uint256 batchId);
    event NewSellOrder(address indexed seller, address indexed collateralToken, uint256 amount, uint256 batchId);
    event ReturnBuy(address indexed buyer, address indexed collateralToken, uint256 amount);
    event ReturnSell(address indexed seller, address indexed collateralToken, uint256 value);
    event BatchCleared(address indexed collateralToken, uint256 batchId);

    function initialize(
        IMarketMakerController _controller,
        TokenManager           _tokenManager,
        Vault                  _pool,
        address                _beneficiary,
        IBancorFormula         _formula,
        uint256                _batchBlocks,
        uint256                _fee
        ) external onlyInit
    {
        initialized();

        require(isContract(_controller) && isContract(_tokenManager) && isContract(_pool) && isContract(_formula) && _batchBlocks > 0);

        controller = _controller;
        tokenManager = _tokenManager;
        token = ERC20(tokenManager.token());
        pool = _pool;
        beneficiary = _beneficiary;
        formula = _formula;
        batchBlocks = _batchBlocks;
        feePercentPPM = _fee;
    }

    /***** external functions *****/

     /**
      * @notice Add `_collateralToken.symbol(): string` as a whitelisted collateral
      * @param _collateralToken The address of the collateral token to be added
      * @param _virtualSupply The virtual supply to be used for that collateral token
      * @param _virtualBalance The virtual balance to be used for that collateral token
      * @param _reserveRatio The reserve ratio to be used for that collateral token [in PPM]
    */
    function addCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) external auth(ADD_COLLATERAL_TOKEN_ROLE) {
        require(!collateralTokenInfo[_collateralToken].exists);
        require(_collateralToken == ETH || isContract(_collateralToken));

        collateralTokens[collateralTokensLength] = _collateralToken;
        collateralTokenInfo[_collateralToken].exists = true;
        collateralTokenInfo[_collateralToken].virtualSupply = _virtualSupply;
        collateralTokenInfo[_collateralToken].virtualBalance = _virtualBalance;
        collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;
        collateralTokensLength = collateralTokensLength + 1;

        emit AddCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    /**
     * @notice Update the reserve ratio of `_collateralToken.symbol(): string` to `_reserveRatio` PPM
     * @param _collateralToken The address of the collateral token whose reserve ratio is to be updated
     * @param _reserveRatio The new reserve ratio to be used for that collateral token [in PPM]
    */
    function updateReserveRatio(address _collateralToken, uint32 _reserveRatio) external auth(UPDATE_RESERVE_RATIO_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists);

        collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;
        emit UpdateReserveRatio(_collateralToken, _reserveRatio);
    }

    /**
     * @notice Update the fee percentage deducted from all buy and sell orders to `_fee` PPM
     * @param _fee The new fee to be used [in PPM]
    */
    function updateFee(uint256 _fee) external auth(UPDATE_FEE_ROLE) {
        feePercentPPM = _fee;
        emit UpdateFee(_fee);
    }

    /**
     * @notice Update the gas costs to be included with every buy and sell orders to `_gasCostBuyOrder` and `_gasCostSellOrder` 
     * @param _gasCostBuyOrder The new buy gas amount to be used.
     * @param _gasCostSellOrder The new sell gas amount to be used.
    */
    function updateGasCost(uint256 _gasCostBuyOrder, uint256 _gasCostSellOrder) external auth(UPDATE_GAS_COST_ROLE) {
        gasCostBuyOrder = _gasCostBuyOrder;
        gasCostSellOrder = _gasCostSellOrder;

        emit UpdateGasCost(_gasCostBuyOrder, _gasCostSellOrder);
    }

    /**
     * @dev    Create a buy order into the current batch. NOTICE: totalSupply and balance remain the same [although collateral has been collected and is being held by the pool].
     * @notice Create a buy order worth `@tokenAmount(_collateralToken, _value)`
     * @param _buyer The address of the buyer
     * @param _collateralToken The address of the collateral token to be spent
     * @param _value The amount of collateral token to be spent
    */
    function createBuyOrder(address _buyer, address _collateralToken, uint256 _value) external payable auth(CREATE_BUY_ORDER_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists);
        require(_value != 0);
        require(msg.value >= (_collateralToken == ETH ? gasCostBuyOrder.add(_value) : gasCostBuyOrder));

        _createBuyOrder(_buyer, _collateralToken, _value);
    }

    /**
     * @dev    Create a sell order into the current batch. NOTICE: totalSupply is decremented but balance and pool balance remains the same.
     * @notice Create a sell order worth `@tokenAmount(token, _amount)`
     * @param _seller The address of the seller
     * @param _collateralToken The address of the collateral token to be returned
     * @param _amount The amount of bonded token to be spent
    */
    function createSellOrder(address _seller, address _collateralToken, uint256 _amount) external payable auth(CREATE_SELL_ORDER_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists);
        require(_amount != 0);
        require(token.staticBalanceOf(_seller) >= _amount);
        require(msg.value >= gasCostSellOrder);

        _createSellOrder(_seller, _collateralToken, _amount);
    }

    /**
     * @notice Clear the last batch of orders [if it has not yet been cleared]
    */
    function clearBatches() external {
        require(waitingClear != 0); // require that batch has not yet been cleared
        require(waitingClear < getCurrentBatchId()); // require current batch to be over

        for (uint256 i = 0; i < collateralTokensLength; i++) {
            _clearBatch(collateralTokens[i]);
        }

        waitingClear = 0;
    }

    /**
        @notice Claim the results of `_buyer`'s `_collateralToken.symbol(): string` buys from batch #`_batchId`.
        @param _buyer The address of the user whose buy results are being collected.
        @param _collateralToken The address of the collateral token used.
        @param _batchId The id of the batch used.
    */
    function claimBuy(address _buyer, address _collateralToken, uint256 _batchId) external {
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        require(batch.cleared); // ERROR_BATCH_NOT_CLEARED
        require(batch.buyers[_buyer] != 0); // ALREADY_CLAIMED_OR_JUST_POSSIBLY_EMPTY? // ERROR_ALREADY_CLAIMED

        _claimBuy(_buyer, _collateralToken, _batchId);
        msg.sender.transfer(gasCostBuyOrder);
    }

    /**
        @notice Claim the results of `_seller`'s `_collateralToken.symbol(): string` sells from batch #`_batchId`.
        @param _seller The address of the user whose sale results are being collected.
        @param _collateralToken The address of the collateral token used.
        @param _batchId The id of the batch used.
    */
    function claimSell(address _seller, address _collateralToken, uint256 _batchId) external {
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        require(batch.cleared); // ERROR_BATCH_NOT_CLEARED
        require(batch.sellers[_seller] != 0); // ALREADY_CLAIMED_OR_JUST_POSSIBLY_EMPTY? // ERROR_ALREADY_CLAIMED

        _claimSell(_seller, _collateralToken, _batchId);
        msg.sender.transfer(gasCostSellOrder);
    }


    /***** public view functions *****/

    /**
        @dev Get the current exact price [with no slippage] of the token with respect to a specific collateral token [returned as parts per million for precision].
        
        price = collateral / (tokenSupply * CW)
        price = collateral / (tokenSupply * CW/ppm)
        price = collateral*ppw / tokenSupply*CW

        @param _collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.
        @return The current exact price in parts per million as collateral over token.
    */
    function getPricePPM(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance) public view returns (uint256 price) {
        // return uint256(PPM).mul(_poolBalance) / _totalSupply.mul(collateralTokenInfo[_collateralToken].reserveRatio);
        price = uint256(PPM).mul( _poolBalance.add( collateralTokenInfo[_collateralToken].virtualBalance ) ).div( ( _totalSupply.add( collateralTokenInfo[_collateralToken].virtualSupply ) ).mul( collateralTokenInfo[_collateralToken].reserveRatio ) );
        if (price == 0) {
            price = 1;
        }
    }

    /**
        @dev Get the id [i.e. block number] attached to the current batch of orders.
        @return The id the current batch of orders.
    */
    function getCurrentBatchId() public view returns (uint256) {
        return (block.number / batchBlocks).mul(batchBlocks);
    }

    /**
        @dev Get the estimate result of a purchase in the scenario that it were the only order within the current batch or orders.
        @param _collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.
        @param _buyValue The amount of collateral token to be spent in the purchase.
        @return The number of tokens that would be purchased in this scenario.
    */
    function getBuy(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 _buyValue) public view returns (uint256) {
        return formula.calculatePurchaseReturn(
            _totalSupply.add(collateralTokenInfo[_collateralToken].virtualSupply),
            _poolBalance.add(collateralTokenInfo[_collateralToken].virtualBalance),
            collateralTokenInfo[_collateralToken].reserveRatio,
            _buyValue);
    }

    /**
        @dev Get the estimate result of a sale of tokens in the scenario that it were the only order withint the current batch of orders.
        @param _collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.
        @param _sellAmount The amount of tokens to be sold in the transaction.
        @return The number of collateral tokens that would be returned in this scenario.
    */
    function getSell(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 _sellAmount) public view returns (uint256) {
        return formula.calculateSaleReturn(
            _totalSupply.add(collateralTokenInfo[_collateralToken].virtualSupply),
            _poolBalance.add(collateralTokenInfo[_collateralToken].virtualBalance),
            collateralTokenInfo[_collateralToken].reserveRatio,
            _sellAmount);
    }

    function getBatch(address _collateralToken, uint256 _batchId) public view returns(bool, bool, uint256, uint256, uint256, uint256, uint256, uint256) {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        return (batch.initialized, batch.cleared, batch.poolBalance, batch.totalSupply, batch.totalBuySpend, batch.totalBuyReturn, batch.totalSellSpend, batch.totalSellReturn);
    }

    function getCollateralTokenInfo(address _collateralToken) public view returns (bool, uint256, uint256, uint32) {
        Collateral storage collateral = collateralTokenInfo[_collateralToken];

        return (collateral.exists, collateral.virtualSupply, collateral.virtualBalance, collateral.reserveRatio);
    }

    /***** internal functions *****/

    function _initializeBatch(uint256 _batchId) internal {
        uint256 i;
        address collateralToken;

        // clear previous batch
        for (i = 0; i < collateralTokensLength; i++) {
            collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
        }

        // initialize new batch
        for (i = 0; i < collateralTokensLength; i++) {
            collateralToken = collateralTokens[i];
            collateralTokenInfo[collateralToken].batches[_batchId].poolBalance = controller.poolBalance(collateralToken);
            collateralTokenInfo[collateralToken].batches[_batchId].totalSupply = token.totalSupply();
            collateralTokenInfo[collateralToken].batches[_batchId].initialized = true;
        }

        // reset waitingClear;
        waitingClear = _batchId;
    }

    function _getInitializedBatch(address _collateralToken) internal returns (uint256, Batch storage) {
        uint256 batchId = getCurrentBatchId();
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[batchId];

        if (!batch.initialized) _initializeBatch(batchId);

        return (batchId, batch);
    }

    function _createBuyOrder(address _buyer, address _collateralToken, uint256 _value) internal {
        (uint256 batchId, Batch storage batch) = _getInitializedBatch(_collateralToken);

        uint256 fee = _value.mul(feePercentPPM).div(PPM);
        uint256 valueAfterFee = _value.sub(fee);

        _transfer(_buyer, address(pool), _collateralToken, valueAfterFee);
        if (fee > 0) _transfer(_buyer, controller.beneficiary(), _collateralToken, fee);
        
        batch.totalBuySpend = batch.totalBuySpend.add(valueAfterFee);
        batch.buyers[_buyer] = batch.buyers[_buyer].add(valueAfterFee);

        emit NewBuyOrder(_buyer, _collateralToken, valueAfterFee, batchId);
    }

    function _createSellOrder(address _seller, address _collateralToken, uint256 _amount) internal {
        (uint256 batchId, Batch storage batch) = _getInitializedBatch(_collateralToken);
    
        uint256 fee = _amount.mul(feePercentPPM).div(PPM);
        uint256 amountAfterFee = _amount.sub(fee);
    
        tokenManager.burn(_seller, _amount);
        tokenManager.mint(controller.beneficiary(), fee);

        batch.totalSellSpend = batch.totalSellSpend.add(amountAfterFee);
        batch.sellers[_seller] = batch.sellers[_seller].add(amountAfterFee);

        emit NewSellOrder(_seller, _collateralToken, amountAfterFee, batchId);
    }

    function _claimBuy(address _buyer, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        uint256 buyReturn = (batch.buyers[_buyer].mul(batch.totalBuyReturn)) / batch.totalBuySpend;

        batch.buyers[_buyer] = 0;
        if (buyReturn > 0) {
            tokenManager.burn(address(pool), buyReturn);
            tokenManager.mint(_buyer, buyReturn);
        }

        emit ReturnBuy(_buyer, _collateralToken, buyReturn);
    }

    function _claimSell(address _seller, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        uint256 sellReturn = (batch.totalSellReturn.mul(batch.sellers[_seller])) / batch.totalSellSpend;
        
        batch.sellers[_seller] = 0;
        if (sellReturn > 0) {
            pool.transfer(_collateralToken, _seller, sellReturn);
        }

        emit ReturnSell(_seller, _collateralToken, sellReturn);
    }

    function _clearBatch(address _collateralToken) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[waitingClear];
        
        if (waitingClear == 0) return;
        if (batch.cleared) return;

        _clearMatching(_collateralToken);

        // sell orders already burned their bonded tokens
        // now buy orders bonded tokens need to be minted
        // the resulting tokens are held by this contract until collected by the buyers
        if (batch.totalBuyReturn > 0) tokenManager.mint(address(pool), batch.totalBuyReturn);

        batch.cleared = true;

        emit BatchCleared(_collateralToken, waitingClear);
    }

    /**
        @dev _clearMatching() This function does the work of recording the results of the orders from the current batch. It is instigated from the `_clearBatch()` function and the exact details of how it works are written in the code itself.
        @param collateralToken The address of the collateral token used.
    */
    function _clearMatching(address collateralToken) internal {
        Batch storage cb = collateralTokenInfo[collateralToken].batches[waitingClear]; // clearing batch

        // Do nothing if there were no orders
        if (cb.totalSellSpend == 0 && cb.totalBuySpend == 0) {
            return;
        }
        // The static price is the current exact price in collateral per token.
        uint256 staticPrice = getPricePPM(collateralToken, cb.totalSupply, cb.poolBalance);

        // resultOfSell is the amount of collateral that would result if all the sales took
        // place at the current exact price instead of the bonding curve price over the span
        // of tokens that were sold.
        uint256 resultOfSell = cb.totalSellSpend.mul(staticPrice) / PPM;
        // if the collateral resulting from the sells is GREATER THAN
        // the total amount of collateral to be spent during all buys
        // then all of the buys can be executed at that exact price
        // and the remaining sales can go back to the original bonding
        // curve scenario.
        
        // if more sells than buys
        if (resultOfSell >= cb.totalBuySpend) {
            // total number of tokens created as a result of all of the buys being executed at the
            // current exact price (tokens = collateral / price). staticPrice is in PPM, to avoid
            // overflows it has been re-arranged.
            cb.totalBuyReturn = cb.totalBuySpend.mul(PPM).div(staticPrice);

            // there are some tokens left over to be sold. these should be the difference between
            // the original total sell order, and the result of executing all of the buys
            uint256 remainingSell = cb.totalSellSpend.sub(cb.totalBuyReturn);

            // now that we know how many tokens are left to be sold we can get the amount of collateral
            // generated by selling them through a normal bonding curve execution, based on the
            // original totalSupply and poolBalance (as if the buy orders never existed and the sell
            // order was just smaller than originally thought).
            uint256 remainingSellReturn = getSell(collateralToken, cb.totalSupply, cb.poolBalance, remainingSell);

            // totalSellReturn becomes the result of matching the buy orders
            // plus the getSell() return from selling the remaining tokens
            cb.totalSellReturn = cb.totalBuySpend.add(remainingSellReturn);

            // TotalSupply doesn't need to be changed (keep it commented out). It only needs to be changed
            // by clearSales or clearBuys scenario so that the subsequent clearSales/clearBuys
            // can correctly calculate the purchaseReturn/saleReturn.
            // cb.totalSupply = cb.totalSupply.sub(remainingSell);

            // poolBalance is ultimately only affected by the net difference between the buys and sells
            // cb.poolBalance = cb.poolBalance.sub(remainingSellReturn);

            // if the collateral resulting from the sells is LESS THAN
            // the total amount of collateral to be spent during all buys
            // then all of the sells can be executed at that exact price
            // and the remaining buys can go back to the original bonding
            // curve scenario.

        // more buys than sells
        } else {
            cb.totalSellReturn = resultOfSell;

            // there is some collateral left over to be spent. this should be the difference between
            // the original total buy order, and the result of executing all of the sells.
            // result of buy is collateral spent divided by price. Price = collateral per token (or c/t) but actually including,
            // ppm it is price times ppm (or ppm*c/t). When you take the totalBuySpend of collateral you need to divide it by the price
            // to result in a number of tokens returned from the purchase (t = C / p). Since p = ppm*c/t the result becomes
            // C * t / (ppm*c). The collateral denoms cancel out so you get t/ppm. To find out the
            // actual t value you need to also cancel out the ppm by multiplying it to get just t.
            // re-order this for rounding purposes and you get C*ppm/p
            // uint256 resultOfBuy = cb.totalBuySpend.mul(ppm) / staticPrice;
            uint256 remainingBuy = cb.totalBuySpend.sub(resultOfSell);

            // now that we know how much collateral is left to be spent we can get the amount of tokens
            // generated by spending it through a normal bonding curve execution, based on the
            // original totalSupply and poolBalance (as if the sell orders never existed and the buy
            // order was just smaller than originally thought).
            uint256 remainingBuyReturn = getBuy(collateralToken, cb.totalSupply, cb.poolBalance, remainingBuy);

            // remainingBuyReturn becomes the result of buying out to the sell orders
            // plus the getBuy() return from spending the remaining collateral
            cb.totalBuyReturn = cb.totalSellSpend.add(remainingBuyReturn);

            // TotalSupply doesn't need to be changed (keep it commented out). It only needs to be changed
            // by clearSales or clearBuys scenario so that the subsequent clearSales/clearBuys
            // can correctly calculate the purchaseReturn/saleReturn.
            // cb.totalSupply = cb.totalSupply.add(remainingBuyReturn);

            // poolBalance is ultimately only affected by the net difference between the buys and sells
            // cb.poolBalance = cb.poolBalance.add(remainingBuy);
        }
    }

    function _transfer(address _from, address _to, address _collateralToken, uint256 _amount) internal {
        if (_collateralToken == ETH) {
            _to.transfer(_amount);
        } else {
            require(ERC20(_collateralToken).safeTransferFrom(_from, _to, _amount));
        }
    }

    
}
