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
import "@aragonblack/fundraising-core/contracts/IMarketMakerController.sol";
import "@aragonblack/fundraising-formulas-bancor/contracts/IBancorFormula.sol";


contract BancorCurve is EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");
    bytes32 public constant UPDATE_RESERVE_RATIO_ROLE = keccak256("UPDATE_RESERVE_RATIO_ROLE");

    string private constant ERROR_NOT_CONTRACT = "BC_NOT_CONTRACT";
    string private constant ERROR_INVALID_INIT_PARAMETER = "BC_INVALID_INIT_PARAMETER";
    string private constant ERROR_NOT_COLLATERAL_TOKEN = "BC_NOT_COLLATERAL_TOKEN";
    string private constant ERROR_TRANSFERFROM_FAILED = "BC_TRANSERFROM_FAILED";
    string private constant ERROR_TRANSFER_FAILED = "BC_TRANSER_FAILED";
    string private constant ERROR_BATCH_NOT_CLEARED = "BC_BATCH_NOT_CLEARED";
    string private constant ERROR_ALREADY_CLAIMED = "BC_ALREADY_CLAIMED";
    string private constant ERROR_BUY_OR_SELL_ZERO = "BC_BUY_OR_SELL_ZERO";
    string private constant ERROR_INSUFFICIENT_FUNDS = "BC_INSUFFICIENT_FUNDS";

    uint256 public constant MAX_COLLATERAL_TOKENS = 5;

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
    address public pool;
    
    uint32 public ppm = 1000000;
    uint256 public batchBlocks;
    uint256 public waitingClear;

    uint256 public collateralTokensLength;
    mapping(address => bool) public isCollateralToken;
    mapping(uint256 => address) public collateralTokens;
    mapping(address => uint256) public virtualSupplies;
    mapping(address => uint256) public virtualBalances;
    mapping(address => uint32) public reserveRatios;    
    mapping(address => mapping(uint256 => Batch)) public batchesByCollateralToken;
    mapping(address => mapping(address => uint256[])) public addressToBlocksByCollateralToken;

    event AddCollateralToken(address indexed collateralToken, uint256 virtualSupply, uint256 virtualBalance, uint32 reserveRatio);
    event UpdateReserveRatio(address indexed collateralToken, uint32 reserveRatio);
    event NewBuyOrder(address indexed buyer, address indexed collateralToken, uint256 value);
    event NewSellOrder(address indexed seller, address indexed collateralToken, uint256 amount);
    event ReturnBuy(address indexed buyer, address indexed collateralToken, uint256 amount);
    event ReturnSell(address indexed seller, address indexed collateralToken, uint256 value);


    function initialize(
        IMarketMakerController _controller,
        TokenManager _tokenManager,
        IBancorFormula _formula,
        uint256 _batchBlocks,
        address[] _collateralTokens,
        uint256[] _virtualSupplies,
        uint256[] _virtualBalances,
        uint32[] _reserveRatios
        ) external onlyInit {

        initialized();

        require(isContract(_controller), ERROR_NOT_CONTRACT);
        require(isContract(_tokenManager), ERROR_NOT_CONTRACT);
        require(isContract(_formula), ERROR_NOT_CONTRACT);
        require(_batchBlocks > 0, ERROR_INVALID_INIT_PARAMETER);
        require(_collateralTokens.length <= MAX_COLLATERAL_TOKENS, ERROR_INVALID_INIT_PARAMETER);

        // There are all uint so they can't be negative anyhow, right?
        // require(_collateralTokens.length >= 0, ERROR_INVALID_INIT_PARAMETER);
        // require(_virtualSupplies.length >= 0, ERROR_INVALID_INIT_PARAMETER);
        // require(_virtualBalances.length >= 0, ERROR_INVALID_INIT_PARAMETER);
        // require(_reserveRatios.length >= 0, ERROR_INVALID_INIT_PARAMETER);

        uint256 len = _collateralTokens.length;
        require(
            len == _virtualSupplies.length &&
            len == _virtualBalances.length &&
            len == _reserveRatios.length, ERROR_INVALID_INIT_PARAMETER);
        
        controller = _controller;
        tokenManager = _tokenManager;
        token = ERC20(tokenManager.token());
        formula = _formula;
        pool = _controller.pool();
        batchBlocks = _batchBlocks;

        for (uint256 i = 0; i < _collateralTokens.length; i++) {
            _addCollateralToken(_collateralTokens[i], _virtualSupplies[i], _virtualBalances[i], _reserveRatios[i]);
        }
    }

    /***** external functions *****/

     /**
        @notice Update the reserve ratio of `_collateralToken.symbol(): string` to `_reserveRatio` PPM.
        @param _collateralToken The address of the collateral token used.
        @param _reserveRatio The new reserve ratio to be used for that collateral token [in PPM].
    */
    function updateReserveRatio(address _collateralToken, uint32 _reserveRatio) external auth(UPDATE_RESERVE_RATIO_ROLE) {
        require(isCollateralToken[_collateralToken], ERROR_NOT_COLLATERAL_TOKEN);

        _updateReserveRatio(_collateralToken, _reserveRatio); 
    }

    /**
        @dev Create a buy order into the current batch.
             TODO: Add gas charge for the claimSell()
             NOTICE: totalSupply remains the same and balance remains the same [although collateral has been collected and is being held by pool].
        @param _buyer The address of the buyer.
        @param _collateralToken The address of the collateral token used.
        @param _value The amount of collateral token the user would like to spend.
    */
    function createBuyOrder(address _buyer, address _collateralToken, uint256 _value) external auth(CREATE_BUY_ORDER_ROLE) {
        require(isCollateralToken[_collateralToken], ERROR_NOT_COLLATERAL_TOKEN);
        require(_value != 0, ERROR_BUY_OR_SELL_ZERO);

        _createBuyOrder(_buyer, _collateralToken, _value);
    }

    /**
        @dev Create a sell order into the current batch.
             TODO: Add gas charge for the claimBuy()
             NOTICE: totalSupply is decremented but the pool balance remains the same.
        @param _seller The address of the seller.
        @param _collateralToken The address of the collateral token used.
        @param _amount The amount of tokens to be sold.
    */
    function createSellOrder(address _seller, address _collateralToken, uint256 _amount) external auth(CREATE_SELL_ORDER_ROLE) {
        require(token.staticBalanceOf(_seller) >= _amount, ERROR_INSUFFICIENT_FUNDS);
        require(isCollateralToken[_collateralToken], ERROR_NOT_COLLATERAL_TOKEN);
        require(_amount != 0, ERROR_BUY_OR_SELL_ZERO);

        _createSellOrder(_seller, _collateralToken, _amount);
    }

    /**
        @notice Clear the last batch of orders if it has not yet been cleared.
    */
    function clearBatches() external {
        for (uint256 i = 1; i <= collateralTokensLength; i++) {
            _clearBatch(collateralTokens[i]);
        }
    }

    /**
        @notice Claim the results of `_buyer`'s `_collateralToken.symbol(): string` buys from batch #`_batchId`.
                TODO: Add gas refund from the addBuy()
        @param _buyer The address of the user whose buy results are being collected.
        @param _collateralToken The address of the collateral token used.
        @param _batchId The id of the batch used.
    */
    function claimBuy(address _buyer, address _collateralToken, uint256 _batchId) external {
        require(isCollateralToken[_collateralToken], ERROR_NOT_COLLATERAL_TOKEN);
        Batch storage batch = batchesByCollateralToken[_collateralToken][_batchId];
        require(batch.cleared, ERROR_BATCH_NOT_CLEARED);
        require(batch.buyers[_buyer] != 0, ERROR_ALREADY_CLAIMED); // ALREADY_CLAIMED_OR_JUST_POSSIBLY_EMPTY?

        _claimBuy(_buyer, _collateralToken, _batchId);
    }

    /**
        @notice Claim the results of `_seller`'s `_collateralToken.symbol(): string` sells from batch #`_batchId`.
                TODO: Add gas refund from the addSell()
        @param _seller The address of the user whose sale results are being collected.
        @param _collateralToken The address of the collateral token used.
        @param _batchId The id of the batch used.
    */
    function claimSell(address _seller, address _collateralToken, uint256 _batchId) external {
        require(isCollateralToken[_collateralToken], ERROR_NOT_COLLATERAL_TOKEN);
        Batch storage batch = batchesByCollateralToken[_collateralToken][_batchId];
        require(batch.cleared, ERROR_BATCH_NOT_CLEARED);
        require(batch.sellers[_seller] != 0, ERROR_ALREADY_CLAIMED); // ALREADY_CLAIMED_OR_JUST_POSSIBLY_EMPTY?

        _claimSell(_seller, _collateralToken, _batchId);
    }

    /***** public view functions *****/

     /**
        @dev Get the current exact price [with no slippage] of the token with respect to a specific collateral token [returned as parts per million for precision].
        @param _collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.
        @return The current exact price in parts per million.
    */
    function getPricePPM(address _collateralToken, uint256 _totalSupply, uint256 _poolBalance) public view returns (uint256) {
        return uint256(ppm).mul(_poolBalance) / _totalSupply.mul(reserveRatios[_collateralToken]);
    }

    /**
        @dev Get the id [i.e. block number] attached to the current batch of orders.
        @return The id the current batch of orders.
    */
    function getCurrentBatchId() public view returns (uint256) {
        return ((block.number).div(batchBlocks)).mul(batchBlocks);
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
            _totalSupply.add(virtualSupplies[_collateralToken]),
            _poolBalance.add(virtualBalances[_collateralToken]),
            reserveRatios[_collateralToken],
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
            _totalSupply.add(virtualSupplies[_collateralToken]),
            _poolBalance.add(virtualBalances[_collateralToken]),
            reserveRatios[_collateralToken],
            _sellAmount);
    }

    /***** internal functions *****/

    function _updateReserveRatio(address _collateralToken, uint32 _reserveRatio) internal {
        reserveRatios[_collateralToken] = _reserveRatio;

        emit UpdateReserveRatio(_collateralToken, _reserveRatio);
    }

    function _addCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) internal {
        collateralTokensLength = collateralTokensLength + 1;
        collateralTokens[collateralTokensLength] = _collateralToken;
        isCollateralToken[_collateralToken] = true;
        virtualSupplies[_collateralToken] = _virtualSupply;
        virtualBalances[_collateralToken] = _virtualBalance;
        reserveRatios[_collateralToken] = _reserveRatio;

        emit AddCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    function _createBuyOrder(address _buyer, address _collateralToken, uint256 _value) internal {
        uint256 batchId = getCurrentBatchId();
        Batch storage batch = _getInitializedBatch(_collateralToken, batchId);

        require(ERC20(_collateralToken).safeTransferFrom(_buyer, address(pool), _value), ERROR_TRANSFERFROM_FAILED);
        batch.totalBuySpend = batch.totalBuySpend.add(_value);
        if (batch.buyers[_buyer] == 0) {
            addressToBlocksByCollateralToken[_collateralToken][_buyer].push(batchId);
        }
        batch.buyers[_buyer] = batch.buyers[_buyer].add(_value);

        emit NewBuyOrder(_buyer, _collateralToken, _value);
    }

    function _createSellOrder(address _seller, address _collateralToken, uint256 _amount) internal {
        uint256 batchId = getCurrentBatchId();
        Batch storage batch = _getInitializedBatch(_collateralToken, batchId);
    
        batch.totalSellSpend = batch.totalSellSpend.add(_amount);
        if (batch.sellers[msg.sender] == 0) {
            addressToBlocksByCollateralToken[_collateralToken][_seller].push(batchId);
        }
        batch.sellers[_seller] = batch.sellers[_seller].add(_amount);
        tokenManager.burn(_seller, _amount);

        emit NewSellOrder(_seller, _collateralToken, _amount);
    }

    function _claimBuy(address _buyer, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = batchesByCollateralToken[_collateralToken][_batchId];
        uint256 buyReturn = (batch.buyers[_buyer].mul(batch.totalBuyReturn)).div(batch.totalBuySpend);

        batch.sellers[_buyer] = 0;
        tokenManager.burn(address(pool), buyReturn);
        tokenManager.mint(_buyer, buyReturn);
        
        emit ReturnBuy(_buyer, _collateralToken, buyReturn);
    }

    function _claimSell(address _seller, address _collateralToken, uint256 _batchId) internal {
        Batch storage batch = batchesByCollateralToken[_collateralToken][_batchId];
        uint256 sellReturn = (batch.totalSellReturn.mul(batch.sellers[_seller])).div(batch.totalSellSpend);
        
        batch.sellers[_seller] = 0;
        require(ERC20(_collateralToken).safeTransfer(_seller, sellReturn), ERROR_TRANSFER_FAILED);

        emit ReturnSell(_seller, _collateralToken, sellReturn);
    }

    /**
        @dev _initBatch() Initialize a new batch of orders, recording the current token supply and pool balance per collateral token.
        @param _batchId The block number of the batch being initialized.
    */
    function _initBatch(uint256 _batchId) internal {
        for (uint256 i = 1; i <= collateralTokensLength; i++) {
            address collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
            batchesByCollateralToken[collateralToken][_batchId].poolBalance = controller.poolBalance(collateralToken);
            batchesByCollateralToken[collateralToken][_batchId].totalSupply = token.totalSupply();
            batchesByCollateralToken[collateralToken][_batchId].init = true;
        }
        waitingClear = _batchId;
    }

    function _getInitializedBatch(address _collateralToken, uint256 _batchId) internal returns (Batch storage) {
        Batch storage batch = batchesByCollateralToken[_collateralToken][_batchId];

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

        Batch storage cb = batchesByCollateralToken[collateralToken][waitingClear]; // clearing batch

        if (cb.cleared) return;
        _clearMatching(collateralToken);


        // The totalSupply was decremented when _burns took place as the sell orders came in. Now
        // the totalSupply needs to be incremented by totalBuyReturn, the resulting tokens are
        // held by this contract until collected by the buyers.
        tokenManager.mint(address(pool), cb.totalBuyReturn);
        cb.cleared = true;
        waitingClear = 0;
    }

    /**
        @dev _clearMatching() This function does the work of recording the results of the orders from the current batch. It is instigated from the `_clearBatch()` function and the exact details of how it works are written in the code itself.

        @param collateralToken The address of the collateral token used.
    */
    function _clearMatching(address collateralToken) internal {
        Batch storage cb = batchesByCollateralToken[collateralToken][waitingClear]; // clearing batch

        // The static price is the current exact price.
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

        } else {
            // total amount of collateral released as a result of all of the sells being executed at the
            // current exact price (collateral =  price * token). staticPrice is in ppm, to avoid
            // overflows it has been re-arranged.
            cb.totalSellReturn = cb.totalSellSpend.mul(staticPrice) / ppm;
            cb.sellsCleared = true;

            // there is some collateral left over to be spent. this should be the difference between
            // the original total buy order, and the result of executing all of the sells
            uint256 resultOfBuy = cb.totalBuySpend.mul(ppm) / staticPrice;
            uint256 remainingBuy = cb.totalBuySpend.sub(resultOfBuy);

            // now that we know how much collateral is left to be spent we can get the amount of tokens
            // generated by spending it through a normal bonding curve execution, based on the
            // original totalSupply and poolBalance (as if the sell orders never existed and the buy
            // order was just smaller than originally thought).
            uint256 remainingBuyReturn = getBuy(collateralToken, cb.totalSupply, cb.poolBalance, remainingBuy);

            // remainingBuyReturn becomes the result of buying out to the sell orders
            // plus the getBuy() return from spending the remaining collateral
            cb.totalBuyReturn = resultOfBuy.add(remainingBuyReturn);

            // TotalSupply doesn't need to be changed (keep it commented out). It only needs to be changed
            // by clearSales or clearBuys scenario so that the subsequent clearSales/clearBuys
            // can correctly calculate the purchaseReturn/saleReturn.
            // cb.totalSupply = cb.totalSupply.add(remainingBuyReturn);

            // poolBalance is ultimately only affected by the net difference between the buys and sells
            // cb.poolBalance = cb.poolBalance.add(remainingBuyReturn);
            cb.buysCleared = true;
        }
    }
}
