/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";

import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@ablack/fundraising-interfaces/contracts/IMarketMakerController.sol";
import "@aragonblack/fundraising-formulas-bancor/contracts/IBancorFormula.sol";

import "@ablack/fundraising-pool/contracts/Pool.sol";

contract BancorCurve is EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO_ROLE = keccak256("UPDATE_RESERVE_RATIO_ROLE");
    bytes32 public constant UPDATE_FEE_ROLE = keccak256("UPDATE_FEE_ROLE");
    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");
    bytes32 public constant UPDATE_GAS_ROLE = keccak256("UPDATE_GAS_ROLE");

    // string private constant ERROR_INVALID_INIT_PARAMETER = "1";
    // string private constant ERROR_NOT_COLLATERAL_TOKEN = "2";
    // string private constant ERROR_TRANSFER_FAILED = "3";
    // string private constant ERROR_BATCH_NOT_CLEARED = "4";
    // string private constant ERROR_ALREADY_CLAIMED = "5";
    // string private constant ERROR_BUY_OR_SELL_ZERO = "6";
    // string private constant ERROR_INSUFFICIENT_FUNDS = "7";
    // string private constant ERROR_GAS_COST_BUY_INSUFFICIENT = "8";
    // string private constant ERROR_GAS_COST_SELL_INSUFFICIENT = "9";

    // uint256 public constant MAX_COLLATERAL_TOKENS = 5;

    uint256 public GAS_COST_BUY_ORDER = 0;
    uint256 public GAS_COST_SELL_ORDER = 0;

    uint256 public FEE_PERCENT_PPM = 0;//10000; // 10,000 / 1,000,000 = 1 / 100 = 1%

    struct Batch {
        bool init;
        bool buysCleared;
        bool sellsCleared;
        bool cleared;
        uint256 poolBalance;
        uint256 totalSupply;
        uint256 totalBuySpend;
        uint256 totalBuyReturn;
        uint256 totalSellSpend;
        uint256 totalSellReturn;
        mapping(address => uint256) buyers;
        mapping(address => uint256) sellers;
    }

    IMarketMakerController public controller;
    TokenManager tokenManager;
    ERC20 public token;
    IBancorFormula formula;
    Pool public pool;
    
    uint32 private constant ppm = 1000000;
    uint256 public batchBlocks;
    uint256 private waitingClear;

    uint256 public collateralTokensLength;
    mapping(uint256 => address) public collateralTokens;
    mapping(address => Collateral) public collateralTokenInfo;
    struct Collateral {
        bool exists;
        uint32 reserveRatio;
        uint256 virtualSupply;
        uint256 virtualBalance;
        mapping(uint256=>Batch) batches;
        mapping(address=>uint256[]) addressToBlocks;
    }

    function getBatch(address _collateralToken, uint256 _batchId) public view returns(bool, bool, bool, bool, uint256, uint256, uint256, uint256, uint256, uint256) {
        Batch batch;
        batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        return (batch.init, batch.buysCleared, batch.sellsCleared, batch.cleared, batch.poolBalance, batch.totalSupply, batch.totalBuySpend, batch.totalBuyReturn, batch.totalSellSpend, batch.totalSellReturn);
    }

    event AddCollateralToken(address indexed collateralToken, uint256 virtualSupply, uint256 virtualBalance, uint32 reserveRatio);
    event UpdateGas(uint256 buyGas, uint256 sellGas);
    event UpdateFee(uint256 reserveRatio);
    event UpdateReserveRatio(address indexed collateralToken, uint32 reserveRatio);
    event NewBuyOrder(address indexed buyer, address indexed collateralToken, uint256 value, uint256 batchId);
    event NewSellOrder(address indexed seller, address indexed collateralToken, uint256 amount, uint256 batchId);
    event ReturnBuy(address indexed buyer, address indexed collateralToken, uint256 amount);
    event ReturnSell(address indexed seller, address indexed collateralToken, uint256 value);

    function initialize(
        IMarketMakerController _controller,
        TokenManager _tokenManager,
        IBancorFormula _formula,
        uint256 _batchBlocks
        ) external onlyInit {

        initialized();

        require(
            isContract(_controller) &&
            isContract(_tokenManager) &&
            isContract(_formula) &&
            _batchBlocks > 0); // ERROR_INVALID_INIT_PARAMETER

        controller = _controller;
        tokenManager = _tokenManager;
        token = ERC20(tokenManager.token());
        formula = _formula;
        pool = Pool(_controller.pool());
        batchBlocks = _batchBlocks;
    }

    /***** external functions *****/


    function addCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) external auth(ADD_COLLATERAL_TOKEN_ROLE) {
        require(!collateralTokenInfo[_collateralToken].exists, "CollateralToken Already Exists");
        // add checks here
        collateralTokensLength = collateralTokensLength + 1;
        collateralTokens[collateralTokensLength] = _collateralToken;
        collateralTokenInfo[_collateralToken].exists = true;
        collateralTokenInfo[_collateralToken].virtualSupply = _virtualSupply;
        collateralTokenInfo[_collateralToken].virtualBalance = _virtualBalance;
        collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;

        emit AddCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    /**
        @notice Update the reserve ratio of `_collateralToken.symbol(): string` to `_reserveRatio` PPM.
        @param _collateralToken The address of the collateral token used.
        @param _reserveRatio The new reserve ratio to be used for that collateral token [in PPM].
    */
    function updateReserveRatio(address _collateralToken, uint32 _reserveRatio) external auth(UPDATE_RESERVE_RATIO_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        // _updateReserveRatio(_collateralToken, _reserveRatio); 
        collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;
        emit UpdateReserveRatio(_collateralToken, _reserveRatio);
    }


    /**
        @notice Update the _buyGas and _sellGas to be included with buys and sells.
        @param _buyGas The new buy gas amount to be used.
        @param _sellGas The new sell gas amount to be used.
    */

    function updateGas(uint256 _buyGas, uint256 _sellGas) external auth(UPDATE_GAS_ROLE) {
        // _updateGas(_buyGas, _sellGas);

        GAS_COST_BUY_ORDER = _buyGas;
        GAS_COST_SELL_ORDER = _sellGas;

        emit UpdateGas(_buyGas, _sellGas);
    }

    /**
        @notice Update the fee percentage removed from all buy and sells.
        @param _fee The new fee to be used [in PPM].
    */
    function updateFee(uint256 _fee) external auth(UPDATE_FEE_ROLE) {
        // _updateFee(_fee); 
        FEE_PERCENT_PPM = _fee;
        emit UpdateFee(_fee);
    }

    /**
        @dev Create a buy order into the current batch.
             NOTICE: totalSupply remains the same and balance remains the same [although collateral has been collected and is being held by pool].
        @param _buyer The address of the buyer.
        @param _collateralToken The address of the collateral token used.
        @param _value The amount of collateral token the user would like to spend.
    */
    function createBuyOrder(address _buyer, address _collateralToken, uint256 _value) payable external auth(CREATE_BUY_ORDER_ROLE) {
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        require(_value != 0, "6"); // ERROR_BUY_OR_SELL_ZERO
        require(msg.value >= GAS_COST_BUY_ORDER, "8"); // ERROR_GAS_COST_BUY_INSUFFICIENT
        if (_collateralToken == ETH) {
            require(msg.value >= GAS_COST_BUY_ORDER.add(_value), "8"); // ERROR_GAS_COST_BUY_INSUFFICIENT
        }
        _createBuyOrder(_buyer, _collateralToken, _value);
    }

    /**
        @dev Create a sell order into the current batch.
             NOTICE: totalSupply is decremented but the pool balance remains the same.
        @param _seller The address of the seller.
        @param _collateralToken The address of the collateral token used.
        @param _amount The amount of tokens to be sold.
    */
    function createSellOrder(address _seller, address _collateralToken, uint256 _amount) payable external auth(CREATE_SELL_ORDER_ROLE) {
        require(token.staticBalanceOf(_seller) >= _amount, "7"); // ERROR_INSUFFICIENT_FUNDS
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        require(_amount != 0, "6"); // ERROR_BUY_OR_SELL_ZERO
        require(msg.value >= GAS_COST_SELL_ORDER, "9"); // ERROR_GAS_COST_SELL_INSUFFICIENT

        _createSellOrder(_seller, _collateralToken, _amount);
    }

    /**
        @notice Clear the last batch of orders if it has not yet been cleared.
    */
    function clearBatches() external isInitialized {
        for (uint256 i = 1; i <= collateralTokensLength; i++) {
            _clearBatch(collateralTokens[i]);
        }
    }

    /**
        @notice Claim the results of `_buyer`'s `_collateralToken.symbol(): string` buys from batch #`_batchId`.
        @param _buyer The address of the user whose buy results are being collected.
        @param _collateralToken The address of the collateral token used.
        @param _batchId The id of the batch used.
    */
    function claimBuy(address _buyer, address _collateralToken, uint256 _batchId) external isInitialized  {
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        require(batch.cleared, "4"); // ERROR_BATCH_NOT_CLEARED
        require(batch.buyers[_buyer] != 0, "5"); // ALREADY_CLAIMED_OR_JUST_POSSIBLY_EMPTY? // ERROR_ALREADY_CLAIMED

        _claimBuy(_buyer, _collateralToken, _batchId);
        msg.sender.transfer(GAS_COST_BUY_ORDER);
    }

    /**
        @notice Claim the results of `_seller`'s `_collateralToken.symbol(): string` sells from batch #`_batchId`.
        @param _seller The address of the user whose sale results are being collected.
        @param _collateralToken The address of the collateral token used.
        @param _batchId The id of the batch used.
    */
    function claimSell(address _seller, address _collateralToken, uint256 _batchId) external isInitialized  {
        require(collateralTokenInfo[_collateralToken].exists); // ERROR_NOT_COLLATERAL_TOKEN
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        require(batch.cleared, "4"); // ERROR_BATCH_NOT_CLEARED
        require(batch.sellers[_seller] != 0, "5"); // ALREADY_CLAIMED_OR_JUST_POSSIBLY_EMPTY? // ERROR_ALREADY_CLAIMED

        _claimSell(_seller, _collateralToken, _batchId);
        msg.sender.transfer(GAS_COST_SELL_ORDER);
    }

    /***** external view functions *****/

    // /**
    //     @dev Get whether a collateral token exists
    //     @param _collateralToken The address of the collateral token used.
    //     @return Whether or not the collateral token exists.
    // */
    // function isCollateralToken(address _collateralToken) external view returns (bool) {
    //     return collateralTokenInfo[_collateralToken].exists;
    // }

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
    function getPricePPM(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance) public view isInitialized returns (uint256) {
        // return uint256(ppm).mul(_poolBalance) / _totalSupply.mul(collateralTokenInfo[_collateralToken].reserveRatio);
        return uint256(ppm).mul( _poolBalance.add( collateralTokenInfo[_collateralToken].virtualBalance ) ) / ( ( _totalSupply.add( collateralTokenInfo[_collateralToken].virtualSupply ) ).mul( collateralTokenInfo[_collateralToken].reserveRatio ) );
    }

    /**
        @dev Get the id [i.e. block number] attached to the current batch of orders.
        @return The id the current batch of orders.
    */
    function getCurrentBatchId() public view isInitialized returns (uint256) {
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
    function getBuy(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 _buyValue) public view isInitialized returns (uint256) {
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
    function getSell(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 _sellAmount) public view isInitialized returns (uint256) {
        return formula.calculateSaleReturn(
            _totalSupply.add(collateralTokenInfo[_collateralToken].virtualSupply),
            _poolBalance.add(collateralTokenInfo[_collateralToken].virtualBalance),
            collateralTokenInfo[_collateralToken].reserveRatio,
            _sellAmount);
    }

    /***** internal functions *****/

    // function _updateReserveRatio(address _collateralToken, uint32 _reserveRatio) internal {
    //     collateralTokenInfo[_collateralToken].reserveRatio = _reserveRatio;
    //     emit UpdateReserveRatio(_collateralToken, _reserveRatio);
    // }

    // function _updateFee(uint256 _fee) internal {
    //     FEE_PERCENT_PPM = _fee;
    //     emit UpdateFee(_fee);
    // }

    // function _updateGas(uint256 _buyGas, uint256 _sellGas) internal {

    //     GAS_COST_BUY_ORDER = _buyGas;
    //     GAS_COST_SELL_ORDER = _sellGas;

    //     emit UpdateGas(_buyGas, _sellGas);
    // }

    function _createBuyOrder(address _buyer, address _collateralToken, uint256 _value) internal {
        uint256 batchId = getCurrentBatchId();
        Batch storage batch = _getInitializedBatch(_collateralToken, batchId);

        // Alternatively this but more gas expensive:
        // Pool(pool).deposit(_collateralToken, _value); // ETH needs value attached to it...
        if (_collateralToken == ETH) {
            address(pool).transfer(_value);
        } else {
            require(ERC20(_collateralToken).safeTransferFrom(_buyer, address(pool), _value), "3"); // ERROR_TRANSFER_FAILED
        }

        uint256 fee = _value.mul(FEE_PERCENT_PPM) / ppm;
        uint256 valueAfterFee = _value.sub(fee);

        batch.totalBuySpend = batch.totalBuySpend.add(valueAfterFee);
        if (batch.buyers[_buyer] == 0) {
            collateralTokenInfo[_collateralToken].addressToBlocks[_buyer].push(batchId);
        }
        batch.buyers[_buyer] = batch.buyers[_buyer].add(valueAfterFee);

        //TODO: Should the event show the value sent or the value after the fee?
        emit NewBuyOrder(_buyer, _collateralToken, valueAfterFee, batchId);
    }

    // TODO: Should the fee on the sell be in bc token or the collateral token?
    function _createSellOrder(address _seller, address _collateralToken, uint256 _amount) internal {
        uint256 batchId = getCurrentBatchId();
        Batch storage batch = _getInitializedBatch(_collateralToken, batchId);
    
        uint256 fee = _amount.mul(FEE_PERCENT_PPM) / ppm;
        uint256 amounAtfterFee = _amount.sub(fee);

        batch.totalSellSpend = batch.totalSellSpend.add(amounAtfterFee);
        if (batch.sellers[msg.sender] == 0) {
            collateralTokenInfo[_collateralToken].addressToBlocks[_seller].push(batchId);
        }
        batch.sellers[_seller] = batch.sellers[_seller].add(amounAtfterFee);
        tokenManager.burn(_seller, _amount);
        tokenManager.mint(address(pool), fee); // TODO: Make sure this is the most efficient way to do this

        //TODO: Should the event show the amount sent or the amount after the fee? 
        emit NewSellOrder(_seller, _collateralToken, amounAtfterFee, batchId);
    }

    function _claimBuy(address _buyer, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        uint256 buyReturn = (batch.buyers[_buyer].mul(batch.totalBuyReturn)) / batch.totalBuySpend;

        batch.buyers[_buyer] = 0;
        tokenManager.burn(address(pool), buyReturn);
        tokenManager.mint(_buyer, buyReturn);
        
        emit ReturnBuy(_buyer, _collateralToken, buyReturn);
    }

    function _claimSell(address _seller, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];
        uint256 sellReturn = (batch.totalSellReturn.mul(batch.sellers[_seller])) / batch.totalSellSpend;
        
        batch.sellers[_seller] = 0;
        pool.transfer(_collateralToken, _seller, sellReturn);

        emit ReturnSell(_seller, _collateralToken, sellReturn);
    }

    /**
        @dev _initBatch() Initialize a new batch of orders, recording the current token supply and pool balance per collateral token.
        @param _batchId The block number of the batch being initialized.
    */
    function _initBatch(uint256 _batchId) internal {
        address collateralToken ;
        uint256 i;
        for (i = 0; i < collateralTokensLength; i++) {
            collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
        }
        for (i = 0; i < collateralTokensLength; i++) {
            collateralToken = collateralTokens[i];
            collateralTokenInfo[collateralToken].batches[_batchId].poolBalance = controller.poolBalance(collateralToken);
            collateralTokenInfo[collateralToken].batches[_batchId].totalSupply = token.totalSupply();
            collateralTokenInfo[collateralToken].batches[_batchId].init = true;
        }
        waitingClear = _batchId;
    }

    function _getInitializedBatch(address _collateralToken, uint256 _batchId) internal returns (Batch storage) {
        Batch storage batch = collateralTokenInfo[_collateralToken].batches[_batchId];

        if (!batch.init)
            _initBatch(_batchId);

        return batch;
    }

    /**
        @dev _clearBatch() This function closes the currently opened batch and records the total amount spent on buys and the total amount of tokens sold. These numbers are used recorded in a way that the buyers and sellers can withdraw the amounts asynchronously. It also prepares the contract to begin the next batch of orders.
        @param collateralToken The address of the collateral token used.
    */
    function _clearBatch(address collateralToken) internal {
        if (waitingClear == 0) return;

        Batch storage cb = collateralTokenInfo[collateralToken].batches[waitingClear]; // clearing batch

        if (cb.cleared) return;
        _clearMatching(collateralToken);

        // The totalSupply was decremented when _burns took place as the sell orders came in. Now
        // the totalSupply needs to be incremented by totalBuyReturn, the resulting tokens are
        // held by this contract until collected by the buyers.
        tokenManager.mint(address(pool), cb.totalBuyReturn);
        cb.cleared = true;
    }

    /**
        @dev _clearMatching() This function does the work of recording the results of the orders from the current batch. It is instigated from the `_clearBatch()` function and the exact details of how it works are written in the code itself.
        @param collateralToken The address of the collateral token used.
    */
    function _clearMatching(address collateralToken) internal {
        Batch storage cb = collateralTokenInfo[collateralToken].batches[waitingClear]; // clearing batch

        // The static price is the current exact price in collateral per token.
        uint256 staticPrice = getPricePPM(collateralToken, cb.totalSupply, cb.poolBalance);

        // resultOfSell is the amount of collateral that would result if all the sales took
        // place at the current exact price instead of the bonding curve price over the span
        // of tokens that were sold.
        uint256 resultOfSell = cb.totalSellSpend.mul(staticPrice) / ppm;
        // if the collateral resulting from the sells is GREATER THAN
        // the total amount of collateral to be spent during all buys
        // then all of the buys can be executed at that exact price
        // and the remaining sales can go back to the original bonding
        // curve scenario.
        
        // more sells than buys
        if (resultOfSell >= cb.totalBuySpend) {
            // total number of tokens created as a result of all of the buys being executed at the
            // current exact price (tokens = collateral / price). staticPrice is in ppm, to avoid
            // overflows it has been re-arranged.
            cb.totalBuyReturn = cb.totalBuySpend.mul(ppm) / staticPrice;
            cb.buysCleared = true;

            // there are some tokens left over to be sold. these should be the difference between
            // the original total sell order, and the result of executing all of the buys
            uint256 remainingSell = cb.totalSellSpend.sub(resultOfSell);

            // now that we know how many tokens are left to be sold we can get the amount of collateral
            // generated by selling them through a normal bonding curve execution, based on the
            // original totalSupply and poolBalance (as if the buy orders never existed and the sell
            // order was just smaller than originally thought).
            uint256 remainingSellReturn = getSell(collateralToken, cb.totalSupply, cb.poolBalance, remainingSell);

            // totalSellReturn becomes the result of selling out to the buy orders
            // plus the getSell() return from selling the remaining tokens
            cb.totalSellReturn = resultOfSell.add(remainingSellReturn);

            // TotalSupply doesn't need to be changed (keep it commented out). It only needs to be changed
            // by clearSales or clearBuys scenario so that the subsequent clearSales/clearBuys
            // can correctly calculate the purchaseReturn/saleReturn.
            // cb.totalSupply = cb.totalSupply.sub(remainingSell);

            // poolBalance is ultimately only affected by the net difference between the buys and sells
            // cb.poolBalance = cb.poolBalance.sub(remainingSellReturn);
            cb.sellsCleared = true;

            // if the collateral resulting from the sells is LESS THAN
            // the total amount of collateral to be spent during all buys
            // then all of the sells can be executed at that exact price
            // and the remaining buys can go back to the original bonding
            // curve scenario.

        // more buys than sells
        } else {
            cb.totalSellReturn = resultOfSell;
            cb.sellsCleared = true;

            // there is some collateral left over to be spent. this should be the difference between
            // the original total buy order, and the result of executing all of the sells.
            // result of buy is collateral spent divided by price. Price = collateral per token (or c/t) but actually including,
            // ppm it is price times ppm (or ppm*c/t). When you take the totalBuySpend of collateral you need to divide it by the price
            // to result in a number of tokens returned from the purchase (t = C / p). Since p = ppm*c/t the result becomes
            // C * t / (ppm*c). The collateral denoms cancel out so you get t/ppm. To find out the
            // actual t value you need to also cancel out the ppm by multiplying it to get just t.
            // re-order this for rounding purposes and you get C*ppm/p
            uint256 resultOfBuy = cb.totalBuySpend.mul(ppm) / staticPrice;
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
            cb.totalSupply = cb.totalSupply.add(remainingBuyReturn);

            // poolBalance is ultimately only affected by the net difference between the buys and sells
            cb.poolBalance = cb.poolBalance.add(remainingBuyReturn);
            cb.buysCleared = true;
        }
    }
}
