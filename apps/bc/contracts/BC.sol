/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity ^0.4.24;

import "./IBC.sol";
import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "./BancorContracts/converter/BancorFormula.sol";

import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";

import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";

contract BC is EtherTokenConstant, IsContract, AragonApp, IBC, BancorFormula, TokenManager {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    uint32 public ppm = 1000000;
    uint256 public batchBlocks;

    bytes32 public constant BUY_ROLE = keccak256("BUY_ROLE");
    bytes32 public constant SELL_ROLE = keccak256("SELL_ROLE");
    bytes32 public constant UPDATE_CURVE = keccak256("UPDATE_CURVE");

    string private constant ERROR_POOL_NOT_CONTRACT = "BC_POOL_NOT_CONTRACT";
    string private constant ERROR_VAULT_NOT_CONTRACT = "BC_VAULT_NOT_CONTRACT";

    string private constant ERROR_BCTOKEN_NOT_CONTRACT = "BC_TOKEN_NOT_CONTRACT";
    string private constant ERROR_INVALID_INIT_PARAMETER = "INVALID_INIT_PARAMETER";
    string private constant ERROR_TRANSFERFROM_FAILED = "TRANSERFROM_FAILED";
    string private constant ERROR_TRANSFER_FAILED = "TRANSER_FAILED";
    string private constant ERROR_TOKEN_CONTROLLER = "TM_TOKEN_CONTROLLER";

    string private constant ERROR_BATCH_NOT_CLEARED = "BANCOR_BATCH_NOT_CLEARED";
    string private constant ERROR_ALREADY_CLAIMED = "BANCOR_ALREADY_CLAIMED";



    Pool public pool;
    Vault public vault;

    uint256 public MAX_COLLATERAL_TOKENS = 5; // Why ?
    address[] public collateralTokens; // We should turn it into a mapping to ease contract update
    mapping(address => uint256) public virtualSupplies;
    mapping(address => uint256) public virtualBalances;


    mapping(address => uint32) public reserveRatios;

    uint256 public waitingClear;
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
    mapping(address => mapping(uint256 => Batch)) public batchesByCollateralToken;
    mapping(address => mapping(address => uint256[])) public addressToBlocksByCollateralToken;

    event Mint(address indexed to, uint256 amount, address collateralToken);
    event Burn(address indexed burner, uint256 amount, uint256 collateralToken);
    event Buy(address indexed to, uint256 poolBalance, uint tokenSupply, uint256 amountTokens, uint256 totalCostCollateral, uint256 collateralToken);
    event Sell(address indexed from, uint256 poolBalance, uint tokenSupply, uint256 amountTokens, uint256 returnedCollateral, uint256 collateralToken);

// We dont need the vault, right cause the pool is already a Vault
// Also maybe we should put all token manager related thing into a different contract this one inherit to make things cleaner.
    function initialize(
        Pool _pool,
        Vault _vault,
        address[] _collateralTokens,
        uint256[] _virtualSupplies,
        uint256[] _virtualBalances,
        uint32[] _reserveRatios,
        uint256 _batchBlocks,
        MiniMeToken _token,
        bool _transferable,
        uint256 _maxAccountTokens) external onlyInit {

        initialized();

        // From here til demarcated is a reproduction of initialize() within TokenManager.sol (including ERROR_TOKEN_CONTROLLER above)
        require(_token.controller() == address(this), ERROR_TOKEN_CONTROLLER);

        token = _token;
        maxAccountTokens = _maxAccountTokens == 0 ? uint256(-1) : _maxAccountTokens;

        if (token.transfersEnabled() != _transferable) {
            token.enableTransfers(_transferable);
        }
        // End of TokenManager.sol initialize()

        require(isContract(_pool), ERROR_POOL_NOT_CONTRACT);
        require(isContract(_vault), ERROR_VAULT_NOT_CONTRACT);
        require(_batchBlocks >= 0, ERROR_INVALID_INIT_PARAMETER);
        require(_collateralTokens.length <= MAX_COLLATERAL_TOKENS, ERROR_INVALID_INIT_PARAMETER);
        uint256 len = _collateralTokens.length;
        require(
            len == _virtualSupplies.length &&
            len == _virtualBalances.length &&
            len == _reserveRatios.length, ERROR_INVALID_INIT_PARAMETER);
        require(_collateralTokens.length >= 0, ERROR_INVALID_INIT_PARAMETER);
        require(_virtualSupplies.length >= 0, ERROR_INVALID_INIT_PARAMETER);
        require(_virtualBalances.length >= 0, ERROR_INVALID_INIT_PARAMETER);
        require(_reserveRatios.length >= 0, ERROR_INVALID_INIT_PARAMETER);

        pool = _pool;
        vault = _vault;

        for (uint256 i = 0; i < _collateralTokens.length; i++) {
            address collateralToken = _collateralTokens[i];
            virtualSupplies[collateralToken] = _virtualSupplies[i];
            virtualBalances[collateralToken] = _virtualBalances[i];
            reserveRatios[collateralToken] = _reserveRatios[i];
        }
        collateralTokens = _collateralTokens;
        batchBlocks = _batchBlocks;
    }

    /***** external view functions *****/

    // CANT WE GET THIS INFO BY REDUCING EVENTS ?

    /**
    * @dev getUserBlocks() Returns an array of all the batched blocks a user may have or have had an order in.
    * @param _collateralToken The address of the collateral token used.
    * @param _user The address of the user.
    * @return uint256[] An array of batch block id.
    */
    function getUserBlocks(address _collateralToken, address _user) external view returns (uint256[] memory) {
        return addressToBlocksByCollateralToken[_collateralToken][_user];
    }

    /**
        @dev getUserBlocksLength() Returns the number of batches that a user has make an order within.

        @param collateralToken The address of the collateral token used.
        @param user The address of the user in question.

        @return uint256 A number representing how many different batches.
    */
    function getUserBlocksLength(address collateralToken, address user) external view returns (uint256) {
        return addressToBlocksByCollateralToken[collateralToken][user].length;
    }

    /**
        @dev getUserBlocksByIndex() Returns a specific batch block number from the list of all the batches that a user participated in.

        @param collateralToken The address of the collateral token used.
        @param user The address of the user in question.
        @param index The index of the batch in question.

        @return uint256 A number representing how many different batches.
    */
    function getUserBlocksByIndex(address collateralToken, address user, uint256 index) external view returns (uint256) {
        return addressToBlocksByCollateralToken[collateralToken][user][index];
    }

    /**
        @dev isUserBuyerByBlockIndex() Designates whether a user is a buyer with reference to a specific batch block by index.

        @param collateralToken The address of the collateral token used.
        @param user The address of the user in question.
        @param index The index of the batch in question.

        @return bool Whether of not the user in that batch was a buyer.
    */
    function isUserBuyerByBlockIndex(address collateralToken, address user, uint256 index) external view returns (bool) {
        return batchesByCollateralToken[collateralToken][index].buyers[user] > 0;
    }

    /**
        @dev isUserSellerByBlockIndex() Designates whether a user is a seller with reference to a specific batch block by index.

        @param collateralToken The address of the collateral token used.
        @param user The address of the user in question.
        @param index The index of the batch in question.

        @return bool Whether of not the user in that batch was a seller.
    */
    function isUserSellerByBlockIndex(address collateralToken, address user, uint256 index) external view returns (bool) {
        return batchesByCollateralToken[collateralToken][index].sellers[user] > 0;
    }

    /**
        @dev getPolynomial() Returns the family of polynomials describing the curve of this market maker.
        WARNING: This number might suffer from rounding errors and should be corroborated off-chain.

        @param collateralToken The address of the collateral token used.

        @return uint256 a polynomial.
    */
    function getPolynomial(address collateralToken) external view returns (uint256) {
        return uint256(ppm / reserveRatios[collateralToken]).sub(1);
    }

    /**
        @dev getSlopePPM() Returns the slope describing the curve of this market maker in the format of parts per million.

        @param collateralToken The address of the collateral token used.
        @param _totalSupply The total supply of tokens to be used in the calculation.

        @return uint256 The value for slope as represented in parts per million.
    */
    function getSlopePPM(address collateralToken, uint256 _totalSupply) external view returns (uint256) {
        return _totalSupply.mul(ppm).mul(ppm) / (uint256(reserveRatios[collateralToken]).mul(_totalSupply) ** (ppm / reserveRatios[collateralToken]));
    }

    /***** external functions *****/

    /**
        @dev updateReserveRatio() This function let's you update the reserve ratio for a specific collateral token.

        @param collateralToken The address of the collateral token used.
        @param reserveRatioPPM The new reserve ratio to be used for that collateral token.
    */
    function updateReserveRatio(address collateralToken, uint32 reserveRatioPPM) external isInitialized {
        reserveRatios[collateralToken] = reserveRatioPPM;
    }

    /**
        @dev addBuy() This function allows you to enter a buy order into the current batch.

        NOTICE: totalSupply remains the same and balance remains the same
        (although collateral has been collected and is being held by this contract)

        @param _collateralToken The address of the collateral token used.
        @param _value The amount of collateral token the user would like to spend.
        @param sender The address of who should be the benefactor of this purchase.

        @return bool Whether or not the transaction was successful. // Not necesseray given it's external, right ?
    */
    function addBuy(address _collateral, uint256 _value, address _sender) external auth(BUY_ROLE) {
        require(reserveRatios[_collateral] != 0, ERROR_NOT_COLLATERAL_TOKEN);
        require(_value != 0, ERROR_BUY_VALUE_ZERO);

        uint256 batch = currentBatch();
        Batch storage cb = batchesByCollateralToken[_collateral][batch]; // currentBatch
        
        if (!cb.init) {
            _initBatch(batch);
        }
        // Shouldn't we transferFrom directly to the pool ?
        // Shouldn't we use SafeERC20 in case we use tokens not satisfying the standard totally
        require(ERC20(_collateralToken).safeTransferFrom(msg.sender, address(this), _value), ERROR_TRANSFERFROM_FAILED);
        cb.totalBuySpend = cb.totalBuySpend.add(_value);
        if (cb.buyers[_sender] == 0) {
            addressToBlocksByCollateralToken[_collateralToken][_sender].push(batch);
        }
        cb.buyers[_sender] = cb.buyers[_sender].add(_value);
    }

    /**
        @dev addSell() This function allows you to enter a sell order into the current batch.

        NOTICE: totalSupply is decremented but the pool balance remains the same.

        @param collateralToken The address of the collateral token used.
        @param amount The amount of tokens to be sold.

        @return bool Whether or not the transaction was successful.
    */
    function addSell(address collateralToken, uint256 amount) external auth(SELL_ROLE) returns (bool) {
        require(token.balanceOf(msg.sender) >= amount, "insufficient funds to do that");
        uint256 batch = currentBatch();
        Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // currentBatch
        if (!cb.init) {
            _initBatch(batch);
        }
        cb.totalSellSpend = cb.totalSellSpend.add(amount);
        if (cb.sellers[msg.sender] == 0) {
            addressToBlocksByCollateralToken[collateralToken][msg.sender].push(batch);
        }
        cb.sellers[msg.sender] = cb.sellers[msg.sender].add(amount);
        _burn(msg.sender, amount);
        return true;
    }

    // Is there a reason to keep this function as external ? Shouldn't it be an internal function ?
    /**
        @dev clearBatches() This function clears the last batch of orders if it has not yet been cleared.
    */
    function clearBatches() external {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
        }
    }

    // So for each buy or sell your need one transaction right ? Can't we 'automate' that ?
    /**
        @dev claimSell() This function allows a seller to claim the results of their sell from the last batch or for someone else to do so on their behalf.

        @param collateralToken The address of the collateral token used.
        @param batch The block number of the batch in question.
        @param sender The address of the user whose sale results are being collected.
    */
    function claimSell(address collateralToken, uint256 batch, address sender) external {
        Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // claming batch
        require(cb.cleared, ERROR_BATCH_NOT_CLEARED);
        require(cb.sellers[sender] != 0, ERROR_ALREADY_CLAIMED);

        uint256 individualSellReturn = (cb.totalSellReturn.mul(cb.sellers[sender])).div(cb.totalSellSpend);
        cb.sellers[sender] = 0;
        require(ERC20(collateralToken).transfer(sender, individualSellReturn), ERROR_TRANSFER_FAILED); // Shouldn't we use safeERC20 here too ?
        // sender.transfer(individualSellReturn);
    }

    /**
        @dev claimBuy() This function allows a buyer to claim the results of their purchase from the last batch or for someone else to do so on their behalf.

        @param collateralToken The address of the collateral token used.
        @param batch The block number of the batch in question.
        @param sender The address of the user whose buy results are being collected.
    */
    function claimBuy(address collateralToken, uint256 batch, address sender) external {
        Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // claming batch
        require(cb.cleared, "can't claim a batch that hasn't cleared");
        require(cb.buyers[sender] != 0, "already claimed this buy");
        uint256 individualBuyReturn = (cb.buyers[sender].mul(cb.totalBuyReturn)).div(cb.totalBuySpend);
        cb.buyers[sender] = 0;
        _burn(address(this), individualBuyReturn);
        _mint(sender, individualBuyReturn);
    }

    /***** public view functions *****/

    /**
        @dev currentBatch() Returns the block number being attached to the current batch of orders.

        @return uint The block number of the current batch of orders.
    */
    function currentBatch() public view returns (uint) {
      // Shouldn’t we use SafeMath ? I see the trick of int rounding the thing but it should work [more safely] with SafeMath, right ?
        return (block.number / batchBlocks) * batchBlocks;
    }

    /**
        @dev poolBalance() Returns the pool balance of a specific collateral token.
        @param collateralToken The address of the collateral token used.
        @return uint The balance of a specific collateral token.
    */
    function poolBalance(address collateralToken) public view returns (uint) {
        // TODO: Where does this come from??
        // return Tap.poolBalance(collateralToken);
    }

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
        return calculatePurchaseReturn(
            safeAdd(_totalSupply, virtualSupplies[collateralToken]),
            safeAdd(_poolBalance, virtualBalances[collateralToken]),
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
        return calculateSaleReturn(safeAdd(_totalSupply, virtualSupplies[collateralToken]), safeAdd(_poolBalance, virtualBalances[collateralToken]), reserveRatios[collateralToken], sellAmount);
    }

    /***** public functions *****/


    /***** internal functions *****/


    /**
    * @notice Burn `@tokenAmount(self.token(): address, _amount, false)` tokens from `_holder`
    * @param _holder Holder of tokens being burned
    * @param _amount Number of tokens being burned
    */
    function _burn(address _holder, uint256 _amount) internal authP(BURN_ROLE, arr(_holder, _amount)) {
        // minime.destroyTokens() never returns false, only reverts on failure
        token.destroyTokens(_holder, _amount);
    }

    /**
        @dev _initBatch() This function initialized a new batch of orders, recording the current token supply and pool balance per collateral token.

        @param batch The block number of the batch being initialized.
    */
    function _initBatch(uint256 batch) internal {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
            batchesByCollateralToken[collateralToken][batch].poolBalance = poolBalance(collateralToken);
            batchesByCollateralToken[collateralToken][batch].totalSupply = token.totalSupply();
            batchesByCollateralToken[collateralToken][batch].init = true;
        }
        waitingClear = batch;
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
        _mint(address(this), cb.totalBuyReturn);
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
