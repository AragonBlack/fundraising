/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";

import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";

import "./BancorContracts/converter/BancorFormula.sol";

import "./IBC.sol";

contract BC is EtherTokenConstant, IsContract, AragonApp, IBC, BancorFormula {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    uint32 public ppm = 1000000;
    uint256 public batchBlocks;

    // bytes32 public constant _ROLE = keccak256("_ROLE");
    string private constant ERROR_POOL_NOT_CONTRACT = "BC_POOL_NOT_CONTRACT";
    string private constant ERROR_VAULT_NOT_CONTRACT = "BC_VAULT_NOT_CONTRACT";
    string private constant ERROR_TM_NOT_CONTRACT = "BC_TOKEN_MANAGER_NOT_CONTRACT";
    
    string private constant ERROR_BCTOKEN_NOT_CONTRACT = "BC_TOKEN_NOT_CONTRACT";
    string private constant ERROR_INVALID_INIT_PARAMETER = "INVALID_INIT_PARAMETER";
    string private constant ERROR_TRANSFERFROM_FAILED = "TRANSERFROM_FAILED";
    string private constant ERROR_TRANSFER_FAILED = "TRANSER_FAILED";

    Pool public pool;
    Vault public vault;
    TokenManager public tokenManager;

    address public bondingCurveToken;

    uint256 public MAX_COLLATERAL_TOKENS = 5;
    address[] public collateralTokens;
    mapping(address => uint256) public virtualSupplies;
    mapping(address => uint256) public virtualBalances;
    
    mapping(address => uint256) public tokenSupplies;
    mapping(address => uint256) public poolBalances;

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
    mapping(address=>mapping(uint256 => Batch)) public batchesByCollateralToken;
    mapping(address=>mapping(address => uint256[])) public addressToBlocksByCollateralToken;

    event Mint(address indexed to, uint256 amount, address collateralToken);
    event Burn(address indexed burner, uint256 amount, uint256 collateralToken);
    event Buy(address indexed to, uint256 poolBalance, uint tokenSupply, uint256 amountTokens, uint256 totalCostCollateral, uint256 collateralToken);
    event Sell(address indexed from, uint256 poolBalance, uint tokenSupply, uint256 amountTokens, uint256 returnedCollateral, uint256 collateralToken);

    function initialize(
        Pool _pool,
        Vault _vault,
        TokenManager _tokenManager,
        address _bondingCurveToken,
        address[] _collateralTokens,
        uint256[] _virtualSupplies,
        uint256[] _virtualBalances,
        uint32[] _reserveRatios,
        uint256 _batchBlocks) public onlyInit {
        initialized();

        require(isContract(_pool), ERROR_POOL_NOT_CONTRACT);
        require(isContract(_vault), ERROR_VAULT_NOT_CONTRACT);
        require(isContract(_tokenManager), ERROR_TM_NOT_CONTRACT);
        require(isContract(_bondingCurveToken), ERROR_BCTOKEN_NOT_CONTRACT);
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
        bondingCurveToken = _bondingCurveToken;

        // TODO: is it possible to use mappings as init parameters?
        for (uint256 i = 0; i < _collateralTokens.length; i++) {
            address collateralToken = _collateralTokens[i];
            virtualSupplies[collateralToken] = _virtualSupplies[i];
            virtualBalances[collateralToken] = _virtualBalances[i];
            reserveRatios[collateralToken] = _reserveRatios[i];
        }
        collateralTokens = _collateralTokens;
        batchBlocks = _batchBlocks;
    }

    /***** external function *****/
    // function buy(uint256 _value) external payable;
    // function sell(uint256 _amount) external;

    function updateReserveRatio(address collateralToken, uint32 reserveRatioPPM) external isInitialized {
        reserveRatios[collateralToken] = reserveRatioPPM;
    }
    function updateTokenSupply(address collateralToken, uint256 tokenSupply) external isInitialized {
        tokenSupplies[collateralToken] = tokenSupply;
    }
    function updatePoolBalance(address collateralToken, uint256 poolBalance) external isInitialized {
        poolBalances[collateralToken] = poolBalance;
    }

    function injectCollateral(uint256 index) external payable isInitialized returns (bool);
    function removeCollateral() external isInitialized returns (bool);

    /***** public functions *****/
    function currentBatch() public view returns (uint cb) {
        cb = (block.number / batchBlocks) * batchBlocks;
    }
    function getUserBlocks(address collateralToken, address user) public view returns (uint256[] memory) {
        return addressToBlocksByCollateralToken[collateralToken][user];
    }
    function getUserBlocksLength(address collateralToken, address user) public view returns (uint256) {
        return addressToBlocksByCollateralToken[collateralToken][user].length;
    }
    function getUserBlocksByIndex(address collateralToken, address user, uint256 index) public view returns (uint256) {
        return addressToBlocksByCollateralToken[collateralToken][user][index];
    }
    function isUserBuyerByBlock(address collateralToken, address user, uint256 index) public view returns (bool) {
        return batchesByCollateralToken[collateralToken][index].buyers[user] > 0;
    }
    function isUserSellerByBlock(address collateralToken, address user, uint256 index) public view returns (bool) {
        return batchesByCollateralToken[collateralToken][index].sellers[user] > 0;
    }
    function getPolynomial(address collateralToken) public view returns (uint256) {
        return uint256(ppm / reserveRatios[collateralToken]).sub(1);
    }
    // returns in parts per million
    function getSlopePPM(address collateralToken, uint256 _totalSupply) public view returns (uint256) {
        return _totalSupply.mul(ppm).mul(ppm) / (uint256(reserveRatios[collateralToken]).mul(_totalSupply) ** (ppm / reserveRatios[collateralToken]));
    }
    // returns in parts per million
    function getPricePPM(address collateralToken, uint256 _totalSupply, uint256 _poolBalance) public view returns (uint256) {
        return uint256(ppm).mul(_poolBalance) / _totalSupply.mul(reserveRatios[collateralToken]);
        // return getSlope(_totalSupply, _poolBalance).mul(_totalSupply ** getPolynomial()) / ppm;
    }
    function getBuy(address collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 buyValue) public view returns (uint256) {
        return calculatePurchaseReturn(
            safeAdd(_totalSupply, virtualSupplies[collateralToken]), 
            safeAdd(_poolBalance, virtualBalances[collateralToken]), 
            reserveRatios[collateralToken], 
            buyValue);
    }
    function getSell(address collateralToken, uint256 _totalSupply, uint256 _poolBalance, uint256 sellAmount) public view returns (uint256) {
        return calculateSaleReturn(safeAdd(_totalSupply, virtualSupplies[collateralToken]), safeAdd(_poolBalance, virtualBalances[collateralToken]), reserveRatios[collateralToken], sellAmount);
    }

    // totalSupply remains the same
    // balance remains the same (although collateral has been collected)
    function addBuy(address collateralToken, uint256 value, address sender) public returns (bool) {
        uint256 batch = currentBatch();
        Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // currentBatch
        if (!cb.init) {
            _initBatch(batch);
        }
        require(ERC20(collateralToken).transferFrom(msg.sender, address(this), value), ERROR_TRANSFERFROM_FAILED);
        cb.totalBuySpend = cb.totalBuySpend.add(value);
        if (cb.buyers[sender] == 0) {
            addressToBlocksByCollateralToken[collateralToken][sender].push(batch);
        }
        cb.buyers[sender] = cb.buyers[sender].add(value);
        return true;
    }
    // totalSupply is decremented
    // balance remains the same
    function addSell(address collateralToken, uint256 amount) public returns (bool) {
        require(ERC20(bondingCurveToken).balanceOf(msg.sender) >= amount, "insufficient funds to do that");
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
        tokenManager.burn(msg.sender, amount);
        return true;
    }

    function clearBatches() public {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
        }
    }
    /***** internal functions *****/

    function _initBatch(uint256 batch) internal {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address collateralToken = collateralTokens[i];
            _clearBatch(collateralToken);
            batchesByCollateralToken[collateralToken][batch].poolBalance = poolBalances[collateralToken];
            batchesByCollateralToken[collateralToken][batch].totalSupply = ERC20(bondingCurveToken).totalSupply();
            batchesByCollateralToken[collateralToken][batch].init = true;
        }
        waitingClear = batch;
    }

    function _clearBatch(address collateralToken) internal {
        if (waitingClear == 0) return;
        Batch storage cb = batchesByCollateralToken[collateralToken][waitingClear]; // clearing batch
        if (cb.cleared) return;
        _clearMatching(collateralToken);

        poolBalances[collateralToken] = cb.poolBalance; // Does this matter here?


        // The totalSupply was decremented when _burns took place as the sell orders came in. Now
        // the totalSupply needs to be incremented by totalBuyReturn, the resulting tokens are
        // held by this contract until collected by the buyers.
        tokenManager.mint(address(this), cb.totalBuyReturn);
        cb.cleared = true;
        waitingClear = 0;
    }
    
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
            cb.poolBalance = cb.poolBalance.sub(remainingSellReturn);
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
            cb.poolBalance = cb.poolBalance.add(remainingBuyReturn);
            cb.buysCleared = true;
        }
    }
    function claimSell(address collateralToken, uint256 batch, address sender) public {
        Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // claming batch
        require(cb.cleared, "can't claim a batch that hasn't cleared");
        require(cb.sellers[sender] != 0, "already claimed this sell");
        uint256 individualSellReturn = (cb.totalSellReturn.mul(cb.sellers[sender])).div(cb.totalSellSpend);
        cb.sellers[sender] = 0;
        require(ERC20(collateralToken).transfer(sender, individualSellReturn), ERROR_TRANSFER_FAILED);
        // sender.transfer(individualSellReturn);
    }
    function claimBuy(address collateralToken, uint256 batch, address sender) public {
        Batch storage cb = batchesByCollateralToken[collateralToken][batch]; // claming batch
        require(cb.cleared, "can't claim a batch that hasn't cleared");
        require(cb.buyers[sender] != 0, "already claimed this buy");
        uint256 individualBuyReturn = (cb.buyers[sender].mul(cb.totalBuyReturn)).div(cb.totalBuySpend);
        cb.buyers[sender] = 0;
        tokenManager.burn(address(this), individualBuyReturn);
        tokenManager.mint(sender, individualBuyReturn);
    }

}
