/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";

import "@aragon/apps-shared-minime/contracts/ITokenController.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";

import "@aragon/os/contracts/common/IForwarder.sol";

import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";

import "@aragonblack/fundraising-formulas-bancor/contracts/IBancorFormula.sol";
import "@aragonblack/fundraising-core/contracts/IMarketMakerController.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";



contract BancorCurve is EtherTokenConstant, IsContract, /*ITokenController, IForwarder ,*/ AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
    bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");
    // bytes32 public constant UPDATE_CURVE = keccak256("UPDATE_CURVE");

    string private constant ERROR_TOKEN_CONTROLLER = "BC_TOKEN_CONTROLLER";
    string private constant ERROR_CALLER_NOT_TOKEN = "BC_CALLER_NOT_TOKEN";
    string private constant ERROR_NOT_CONTRACT = "BC_NOT_CONTRACT";
    string private constant ERROR_INVALID_INIT_PARAMETER = "BC_INVALID_INIT_PARAMETER";
    string private constant ERROR_NOT_COLLATERAL_TOKEN = "BC_NOT_COLLATERAL_TOKEN";
    string private constant ERROR_TRANSFERFROM_FAILED = "BC_TRANSERFROM_FAILED";
    string private constant ERROR_TRANSFER_FAILED = "BC_TRANSER_FAILED";
    string private constant ERROR_BATCH_NOT_CLEARED = "BC_BATCH_NOT_CLEARED";
    string private constant ERROR_ALREADY_CLAIMED = "BC_ALREADY_CLAIMED";
    string private constant ERROR_BUY_VALUE_ZERO = "BC_BUY_VALUE_ZERO";
    string private constant ERROR_SELL_AMOUNT_ZERO = "BC_SELL_AMOUNT_ZERO";
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
    IBancorFormula formula;
    MiniMeToken public token;
    Pool public pool;

    uint32 public ppm = 1000000;
    uint256 public batchBlocks;
    uint256 public waitingClear;

    uint256 public collateralTokensLength;
    mapping(uint256 => address) public collateralTokens;
    mapping(address => bool) public isCollateralToken;
    mapping(address => uint256) public virtualSupplies;
    mapping(address => uint256) public virtualBalances;
    mapping(address => uint32) public reserveRatios;    
    mapping(address => mapping(uint256 => Batch)) public batchesByCollateralToken;
    mapping(address => mapping(address => uint256[])) public addressToBlocksByCollateralToken;

    // event Mint(address indexed to, uint256 amount, address collateralToken);
    // event Burn(address indexed burner, uint256 amount, uint256 collateralToken);
    event AddCollateralToken(address indexed collateralToken, uint256 virtualSupply, uint256 virtualBalance, uint32 reserveRatio);
    event NewBuyOrder(address indexed buyer, address indexed collateralToken, uint256 value);
    event NewSellOrder(address indexed seller, address indexed collateralToken, uint256 amount);
    // event Buy(address indexed to, uint256 poolBalance, uint tokenSupply, uint256 amountTokens, uint256 totalCostCollateral, uint256 collateralToken);
    // event Sell(address indexed from, uint256 poolBalance, uint tokenSupply, uint256 amountTokens, uint256 returnedCollateral, uint256 collateralToken);

    modifier onlyToken() {
        require(msg.sender == address(token), ERROR_CALLER_NOT_TOKEN);
        _;
    }

    function initialize(
        IMarketMakerController _controller,
        IBancorFormula _formula,
        MiniMeToken _token,
        bool _transferable,
        uint256 _batchBlocks,
        address[] _collateralTokens,
        uint256[] _virtualSupplies,
        uint256[] _virtualBalances,
        uint32[] _reserveRatios
        ) external onlyInit {

        initialized();

        // TokenManager related initialization
        require(_token.controller() == address(this), ERROR_TOKEN_CONTROLLER);
        token = _token;
        if (token.transfersEnabled() != _transferable) {
            token.enableTransfers(_transferable);
        }
        // end
  
        require(isContract(_controller), ERROR_NOT_CONTRACT);
        require(isContract(_formula), ERROR_NOT_CONTRACT);
        require(isContract(_controller.pool()), ERROR_NOT_CONTRACT);
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
        formula = _formula;
        pool = Pool(_controller.pool());

        batchBlocks = _batchBlocks;

        for (uint256 i = 0; i < _collateralTokens.length; i++) {
            _addCollateralToken(_collateralTokens[i], _virtualSupplies[i], _virtualBalances[i], _reserveRatios[i]);
        }
    }

    /***** external functions *****/

    /**
        @dev updateReserveRatio() This function let's you update the reserve ratio for a specific collateral token.
        @param collateralToken The address of the collateral token used.
        @param reserveRatioPPM The new reserve ratio to be used for that collateral token.
    */
    // function updateReserveRatio(address collateralToken, uint32 reserveRatioPPM) external isInitialized {
    //     reserveRatios[collateralToken] = reserveRatioPPM;
    // }

    /**
        @dev addBuy() This function allows you to enter a buy order into the current batch.
             TODO: Add gas charge for the claimSell()
             NOTICE: totalSupply remains the same and balance remains the same (although collateral has been collected and is being held by this contract)
        @param _buyer The address of who should be the benefactor of this purchase.
        @param _collateralToken The address of the collateral token used.
        @param _value The amount of collateral token the user would like to spend.
    */
    function createBuyOrder(address _buyer, address _collateralToken, uint256 _value) external auth(CREATE_BUY_ORDER_ROLE) {
        require(isCollateralToken[_collateralToken], ERROR_NOT_COLLATERAL_TOKEN);
        require(_value != 0, ERROR_BUY_VALUE_ZERO);

        _createBuyOrder(_buyer, _collateralToken, _value);
    }

    // /**
    //     @dev addSell() This function allows you to enter a sell order into the current batch.

    //     TODO: Add gas charge for the claimBuy()
    //     NOTICE: totalSupply is decremented but the pool balance remains the same.

    //     @param _collateralToken The address of the collateral token used.
    //     @param _amount The amount of tokens to be sold.

    //     @return bool Whether or not the transaction was successful.
    // */
    // function addSell(address _seller, address _collateralToken, uint256 _amount) external auth(SELL_ROLE) {
    //     require(token.balanceOf(_seller) >= _amount, ERROR_INSUFFICIENT_FUNDS);
    //     require(_amount != 0, ERROR_SELL_AMOUNT_ZERO);

    //     _addSell(_seller, _collateralToken, _amount);
    // }

    /***** ITokenController functions  *****/ 
    /**
        `onTransfer()`, `onApprove()`, and `proxyPayment()` are callbacks from the MiniMe token
        contract and are only meant to be called through the managed MiniMe token that gets assigned
        during initialization.
    */

    // /**
    //     @dev Notifies the controller about a token transfer allowing the controller to decide whether
    //          to allow it or react if desired (only callable from the token).
    //          Initialization check is implicitly provided by `onlyToken()`.
    //     @param _from The origin of the transfer
    //     @param _to The destination of the transfer
    //     @param _amount The amount of the transfer
    //     @return False if the controller does not authorize the transfer
    // */
    // function onTransfer(address _from, address _to, uint256 _amount) external onlyToken returns (bool) {
    //     return true; // MiniMeToken already checks whether transfers are enable or not
    // }

    /**
         @dev Notifies the controller about an approval allowing the controller to react if desired.
              Initialization check is implicitly provided by `onlyToken()`.
         @return False if the controller does not authorize the approval.
    */
    // function onApprove(address, address, uint) external onlyToken returns (bool) {
    //     return true;
    // }

    // /**
    //     * @dev Called when ether is sent to the MiniMe Token contract
    //     *      Initialization check is implicitly provided by `onlyToken()`.
    //     * @return True if the ether is accepted, false for it to throw
    // */
    // function proxyPayment(address) external payable onlyToken returns (bool) {
    //     return false;
    // }

    //  /***** forwarding functions *****/

    // function isForwarder() external pure returns (bool) {
    //     return true;
    // }

    // /**
    // ** CHECK IF WE SHOULD ALLOW FORWARDING ACTIONS. IT COULD ALSO USERS TO EMPTY THE POOL / SO WE SHOULD ADD THE POOL ADDRESS TO THE BLACKLIST
    // * @notice Execute desired action as a token holder
    // * @dev IForwarder interface conformance. Forwards any token holder action.
    // * @param _evmScript Script being executed
    // */
    // function forward(bytes _evmScript) public {
    //     require(canForward(msg.sender, _evmScript), ERROR_CAN_NOT_FORWARD);
    //     bytes memory input = new bytes(0); // TODO: Consider input for this

    //     // Add the managed token to the blacklist to disallow a token holder from executing actions
    //     // on the token controller's (this contract) behalf
    //     address[] memory blacklist = new address[](1);
    //     blacklist[0] = address(token);

    //     runScript(_evmScript, input, blacklist);
    // }


    // // Is there a reason to keep this function as external ? Shouldn't it be an internal function ?
    // /**
    //     @dev clearBatches() This function clears the last batch of orders if it has not yet been cleared.
    // */
    // function clearBatches() external {
    //     for (uint256 i = 0; i < collateralTokens.length; i++) {
    //         address collateralToken = collateralTokens[i];
    //         _clearBatch(collateralToken);
    //     }
    // }

    // // So for each buy or sell your need one transaction right ? Can't we 'automate' that ?
    // /**
    //     @dev claimSell() This function allows a seller to claim the results of their sell from the last batch or for someone else to do so on their behalf.

    //     TODO: Add gas refund from the addSell()

    //     @param collateralToken The address of the collateral token used.
    //     @param batch The block number of the batch in question.
    //     @param sender The address of the user whose sale results are being collected.
    // */
    // function claimSell(address collateralToken, uint256 batch, address sender) external {
    //     Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // claming batch
    //     require(cb.cleared, ERROR_BATCH_NOT_CLEARED);
    //     require(cb.sellers[sender] != 0, ERROR_ALREADY_CLAIMED);

    //     uint256 individualSellReturn = (cb.totalSellReturn.mul(cb.sellers[sender])).div(cb.totalSellSpend);
    //     cb.sellers[sender] = 0;
    //     require(ERC20(collateralToken).transfer(sender, individualSellReturn), ERROR_TRANSFER_FAILED); // Shouldn't we use safeERC20 here too ?
    //     // sender.transfer(individualSellReturn);
    // }

    // /**
    //     @dev claimBuy() This function allows a buyer to claim the results of their purchase from the last batch or for someone else to do so on their behalf.

    //     TODO: Add gas refund from the addBuy()

    //     @param collateralToken The address of the collateral token used.
    //     @param batch The block number of the batch in question.
    //     @param sender The address of the user whose buy results are being collected.
    // */
    // function claimBuy(address collateralToken, uint256 batch, address sender) external {
    //     Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // claming batch
    //     require(cb.cleared, "can't claim a batch that hasn't cleared");
    //     require(cb.buyers[sender] != 0, "already claimed this buy");
    //     uint256 individualBuyReturn = (cb.buyers[sender].mul(cb.totalBuyReturn)).div(cb.totalBuySpend);
    //     cb.buyers[sender] = 0;
    //     _burn(address(Pool), individualBuyReturn);
    //     _mint(sender, individualBuyReturn);
    // }

    /***** public view functions *****/

    /**
        @dev Get the block number attached to the current batch of orders.
        @return The block number of the current batch of orders.
    */
    function getCurrentBatchBlock() public view returns (uint256) {
        return ((block.number).div(batchBlocks)).mul(batchBlocks);
    }

    // /**
    //     @dev poolBalance() Returns the pool balance of a specific collateral token.
    //     @param collateralToken The address of the collateral token used.
    //     @return uint The balance of a specific collateral token.
    // */
    // function poolBalance(address collateralToken) public view returns (uint) {
    //     // TODO: Where does this come from??
    //     // return Tap.poolBalance(collateralToken);
    // }

    /**
        @dev getPricePPM() Returns the current exact price (with no slippage) of the token with relevance to a specific collateral token, returned as parts per million for precision.

        @param collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.

        @return uint256 The current exact price in parts per million.
    */
    function getPricePPM(address collateralToken, uint256 _totalSupply, uint256 _poolBalance) public view returns (uint256) {
        return uint256(ppm).mul(_poolBalance) / _totalSupply.mul(reserveRatios[collateralToken]);
    }

    /**
        @dev getBuy() Returns the estimate result of a purchase in the scenario that it were the only order within the current batch or orders.

        @param collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.
        @param buyValue The amount of collateral token to be spent in the purchase.

        @return uint256 The number of tokens that would be purchased in this scenario.
    */
    function getBuy(address collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 buyValue) public view returns (uint256) {
        return formula.calculatePurchaseReturn(
            _totalSupply.add(virtualSupplies[collateralToken]),
            _poolBalance.add(virtualBalances[collateralToken]),
            reserveRatios[collateralToken],
            buyValue);
    }

    /**
        @dev getSell() Returns the estimate result of a sale of tokens in the scenario that it were the only order withint the current batch of orders.

        @param collateralToken The address of the collateral token used.
        @param _totalSupply The token supply to be used in the calculation.
        @param _poolBalance The collateral pool balance to be used in the calculation.
        @param sellAmount The amount of tokens to be sold in the transaction.

        @return uint256 The number of collateral tokens that would be returned in this scenario.
    */
    function getSell(address collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 sellAmount) public view returns (uint256) {
        return formula.calculateSaleReturn(_totalSupply.add(virtualSupplies[collateralToken]), _poolBalance.add(virtualBalances[collateralToken]), reserveRatios[collateralToken], sellAmount);
    }

    // /***** public functions *****/

    // /***** forwarding functions*****/
    
    // function canForward(address _sender, bytes) public view returns (bool) {
    //     return hasInitialized() && token.balanceOf(_sender) > 0;
    // }

    // /**
    //     CHECK THAT FUNCTION DEEPER
    //     @dev Disable recovery escape hatch for own token,
    //         as the it has the concept of issuing tokens without assigning them
    // */
    // function allowRecoverability(address _token) public view returns (bool) {
    //     return _token != address(token);
    // }

    // /***** internal functions *****/

    function _addCollateralToken(address _collateralToken, uint256 _virtualSupply, uint256 _virtualBalance, uint32 _reserveRatio) internal {
        collateralTokensLength = collateralTokensLength + 1;
        collateralTokens[collateralTokensLength] = _collateralToken;
        isCollateralToken[_collateralToken] = true;
        virtualSupplies[_collateralToken] = _virtualSupply;
        virtualBalances[_collateralToken] = _virtualBalance;
        reserveRatios[_collateralToken] = _reserveRatio;


        emit AddCollateralToken(_collateralToken, _virtualSupply, _virtualBalance, _reserveRatio);
    }

    /**
        @dev _initBatch() This function initialized a new batch of orders, recording the current token supply and pool balance per collateral token.
        @param batch The block number of the batch being initialized.
    */
    function _initBatch(uint256 batch) internal {
        for (uint256 i = 1; i <= collateralTokensLength; i++) {
            address collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
            batchesByCollateralToken[collateralToken][batch].poolBalance = controller.poolBalance(collateralToken);
            batchesByCollateralToken[collateralToken][batch].totalSupply = token.totalSupply();
            batchesByCollateralToken[collateralToken][batch].init = true;
        }
        waitingClear = batch;
    }

    function _getInitializedBatch(address _collateralToken, uint256 _batchId) internal returns (Batch storage) {
        Batch storage batch = batchesByCollateralToken[_collateralToken][_batchId];

        if (!batch.init)
            _initBatch(_batchId);

        return batch;
    }

    function _createBuyOrder(address _buyer, address _collateralToken, uint256 _value) internal {
        uint256 batchId = getCurrentBatchBlock();
        Batch storage batch = _getInitializedBatch(_collateralToken, batchId);

        require(ERC20(_collateralToken).safeTransferFrom(_buyer, address(pool), _value), ERROR_TRANSFERFROM_FAILED);
        batch.totalBuySpend = batch.totalBuySpend.add(_value);
        if (batch.buyers[_buyer] == 0) {
            addressToBlocksByCollateralToken[_collateralToken][_buyer].push(batchId);
        }
        batch.buyers[_buyer] = batch.buyers[_buyer].add(_value);

        emit NewBuyOrder(_buyer, _collateralToken, _value);
    }

    // function _addSell(address _seller, address _collateralToken, uint256 _amount) internal {
    //     uint256 batchId = getCurrentBatchId();
    //     Batch storage batch = _getInitializedBatch(batchId);
    
    //     batch.totalSellSpend = batch.totalSellSpend.add(_amount);
    //     if (batch.sellers[msg.sender] == 0) {
    //         addressToBlocksByCollateralToken[_collateralToken][_seller].push(batch);
    //     }
    //     batch.sellers[_seller] = batch.sellers[_seller].add(_amount);
    //     _burn(_seller, _amount);

    //     emit AddSell(_seller, _collateralToken, _amount);
    // }

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
        _mint(address(pool), cb.totalBuyReturn);
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

    /***** token manager related internal function *****/
    
    function _mint(address _receiver, uint256 _amount) internal {
        token.generateTokens(_receiver, _amount); // minime.generateTokens() never returns false
    }

    /**
        @notice Burn `@tokenAmount(self.token(): address, _amount, false)` tokens from `_holder`.
        @param _holder Holder of tokens being burned.
        @param _amount Number of tokens being burned.
    */
    function _burn(address _holder, uint256 _amount) internal {
        token.destroyTokens(_holder, _amount); // minime.destroyTokens() never returns false, only reverts on failure
    }

}
