/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/TimeHelpers.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/apps-vault/contracts/Vault.sol";


contract Tap is TimeHelpers, EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    bytes32 public constant UPDATE_RESERVE_ROLE = keccak256("UPDATE_RESERVE_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_MAXIMUM_TAP_INCREASE_RATE_ROLE = keccak256("UPDATE_MAXIMUM_TAP_INCREASE_RATE_ROLE");
    bytes32 public constant ADD_TAPPED_TOKEN_ROLE = keccak256("ADD_TAPPED_TOKEN_ROLE");
    bytes32 public constant REMOVE_TAPPED_TOKEN_ROLE = keccak256("REMOVE_TAPPED_TOKEN_ROLE");
    bytes32 public constant UPDATE_TAPPED_TOKEN_ROLE = keccak256("UPDATE_TAPPED_TOKEN_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    uint64 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18
    uint64 public constant COMPOUND_PRECISION = 50; // leads compound computation to cost about 25000 gas

    string private constant ERROR_RESERVE_NOT_CONTRACT = "TAP_RESERVE_NOT_CONTRACT";
    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "TAP_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_ALREADY_TAPPED = "TAP_TOKEN_ALREADY_TAPPED";
    string private constant ERROR_TOKEN_NOT_TAPPED = "TAP_TOKEN_NOT_TAPPED";
    string private constant ERROR_TAP_RATE_ZERO = "TAP_TAP_RATE_ZERO";
    string private constant ERROR_TAP_INCREASE_EXCEEDS_LIMIT = "TAP_TAP_INCREASE_EXCEEDS_LIMIT";
    string private constant ERROR_WITHDRAWAL_AMOUNT_ZERO = "TAP_WITHDRAWAL_AMOUNT_ZERO";

    Vault public reserve;
    address public beneficiary;
    uint256 public maximumTapIncreaseRate; // expressed in percentage / second

    mapping (address => uint256) public taps;
    mapping (address => uint256) public lastWithdrawals;
    mapping (address => uint256) public lastTapUpdates;

    event UpdateReserve(address indexed reserve);
    event UpdateBeneficiary(address indexed beneficiary);
    event UpdateMaximumTapIncreaseRate(uint256 maximumTapIncreaseRate);
    event AddTappedToken(address indexed token, uint256 tap);
    event RemoveTappedToken(address indexed token);
    event UpdateTappedToken(address indexed token, uint256 tap);
    event Withdraw(address indexed token, uint256 amount);


    /***** external function *****/

    function initialize(Vault _reserve, address _beneficiary, uint256 _maximumTapIncreaseRate) external onlyInit {
        require(isContract(_reserve), ERROR_RESERVE_NOT_CONTRACT);

        initialized();
        reserve = _reserve;
        beneficiary = _beneficiary;
        maximumTapIncreaseRate = _maximumTapIncreaseRate;
    }

    /**
     * @notice Update reserve to `_reserve`
     * @param _reserve Address of the new reserve
    */
    function updateReserve(Vault _reserve) external auth(UPDATE_RESERVE_ROLE) {
        require(isContract(_reserve), ERROR_RESERVE_NOT_CONTRACT);

        _updateReserve(_reserve);
    }

    /**
     * @notice Update beneficiary to `_beneficiary`
     * @param _beneficiary Address of the new beneficiary
    */
    function updateBeneficiary(address _beneficiary) external auth(UPDATE_BENEFICIARY_ROLE) {
        _updateBeneficiary(_beneficiary);
    }

    /**
     * @notice Update maximum tap increase rate to `@formatPct(_maximumTapIncreaseRate)`% per second
     * @param _maximumTapIncreaseRate New maximum tap increase rate
    */
    function updateMaximumTapIncreaseRate(uint256 _maximumTapIncreaseRate) external auth(UPDATE_MAXIMUM_TAP_INCREASE_RATE_ROLE) {
        _updateMaximumTapIncreaseRate(_maximumTapIncreaseRate);
    }

    /**
     * @notice Add tap for `_token.symbol(): string` at the pace of `@tokenAmount(_token, _tap)` per second
     * @param _token Address of the tapped token
     * @param _tap The tap to be applied applied to that token [in wei / second]
    */
    function addTappedToken(address _token, uint256 _tap) external auth(ADD_TAPPED_TOKEN_ROLE) {
        require(tokenIsETHOrContract(_token), ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(!tokenIsTapped(_token), ERROR_TOKEN_ALREADY_TAPPED);
        require(tapIsValid(_tap), ERROR_TAP_RATE_ZERO);

        _addTappedToken(_token, _tap);
    }

    /**
     * @notice Remove tap for `_token.symbol(): string`
     * @param _token Address of the tapped token to remove
    */
    function removeTappedToken(address _token) external auth(REMOVE_TAPPED_TOKEN_ROLE) {
        require(tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);

        _removeTappedToken(_token);
    }

    /**
     * @notice Update tap for `_token.symbol(): string` to the pace of `@tokenAmount(_token, _tap)` per second
     * @param _token Address of the token whose tap is to be updated
     * @param _tap New tap to be applied to the token [in wei / second]
    */
    function updateTappedToken(address _token, uint256 _tap) external auth(UPDATE_TAPPED_TOKEN_ROLE) {
        require(tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);
        require(tapIsValid(_tap), ERROR_TAP_RATE_ZERO);
        require(tapIncreaseIsValid(_token, _tap), ERROR_TAP_INCREASE_EXCEEDS_LIMIT);

        _updateTappedToken(_token, _tap);
    }

    /**
     * @notice Transfer about `@tokenAmount(_token, self.getMaxWithdrawal(_token))` from `self.reserve()` to `self.beneficiary()`
     * @param _token Address of the token to transfer from reserve to beneficiary
    */
    function withdraw(address _token) external auth(WITHDRAW_ROLE) {
        require(tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);
        uint256 amount = getMaxWithdrawal(_token);
        require(amount > 0, ERROR_WITHDRAWAL_AMOUNT_ZERO);

        _withdraw(_token, amount);
    }

    /***** public functions *****/

    function tokenIsETHOrContract(address _token) public view isInitialized returns (bool) {
        return _token == ETH || isContract(_token);
    }

    function tapIsValid(uint256 _tap) public view isInitialized returns (bool) {
        return _tap > 0;
    }

    function tokenIsTapped(address _token) public view isInitialized returns (bool) {
        return taps[_token] != uint256(0);
    }

    /**
     * @notice Compute the compound result of `k` increasing of 1/`q`th `n` times
     * @dev The computed result is an polynomial estimate of the actual result that will alway be lower than the actual result
     * @dev See https://ethereum.stackexchange.com/questions/10425/is-there-any-efficient-way-to-compute-the-exponentiation-of-a-fraction-and-an-in
     * @param _k The base of the compound computation
     * @param _q The inverse percentage of a one step increase
     * @param _n The number of increase steps
    */
    function compound(uint _k, uint _q, uint _n) public view isInitialized returns (uint) {
        uint s = 0;
        uint N = 1;
        uint B = 1;

        for (uint i = 0; i < COMPOUND_PRECISION; ++i) {
            s += _k * N / B / (_q ** i);
            N = N * (_n - i);
            B = B * (i + 1);
        }
        
        return s;
    }

    function maximumNewTap(address _token) public view isInitialized returns (uint256) {
        if (maximumTapIncreaseRate == 0) {
            return taps[_token];
        } else {
            // maxTapUpdate = taps[_token] * (1 + maxTapIncreasePctPerSecond / PCT_BASE) ^ (secondsSinceLastUpdate)
            // maxTapUpdate = taps[_token] * (1 + 1 / (PCT_BASE / maxTapIncreasePctPerSecond)) ^ (secondsSinceLastUpdate)
            // maxTapUpdate = compound(taps[_token], PCT_BASE / maximumTapIncreaseRate, (getTimestamp()).sub(lastTapUpdates[_token]));
            return compound(taps[_token], PCT_BASE / maximumTapIncreaseRate, getTimestamp().sub(lastTapUpdates[_token]));
        }
    }

    function tapIncreaseIsValid(address _token, uint256 _tap) public view isInitialized returns (bool) {
        if (_tap <= taps[_token]) {
            return true;
        }

         if (maximumTapIncreaseRate == 0) {
            return false;
        }

        if (_tap <= maximumNewTap(_token)) {
            return true;
        }

        return false;
    }

    function getMaxWithdrawal(address _token) public view isInitialized returns (uint256) {
        uint256 balance = balanceOfReserve(_token);
        uint256 tapped = (getTimestamp().sub(lastWithdrawals[_token])).mul(taps[_token]);
        return tapped > balance ? balance : tapped;
    }

    function balanceOfReserve(address _token) public view isInitialized returns (uint256) {
        if (_token == ETH) {
            return address(reserve).balance;
        } else {
            return ERC20(_token).staticBalanceOf(reserve);
        }
    }

    /***** internal functions *****/

    function _updateReserve(Vault _reserve) internal {
        reserve = _reserve;

        emit UpdateReserve(address(_reserve));
    }

    function _updateBeneficiary(address _beneficiary) internal {
        beneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    function _updateMaximumTapIncreaseRate(uint256 _maximumTapIncreaseRate) internal {
        maximumTapIncreaseRate = _maximumTapIncreaseRate;

        emit UpdateMaximumTapIncreaseRate(_maximumTapIncreaseRate);
    }

    function _addTappedToken(address _token, uint256 _tap) internal {
        taps[_token] = _tap;
        lastWithdrawals[_token] = getTimestamp();
        lastTapUpdates[_token] = getTimestamp();

        emit AddTappedToken(_token, _tap);
    }

    function _removeTappedToken(address _token) internal {
        taps[_token] = uint256(0); // no need to re-initialize other data as they will be re-initialized if the token is re-added

        emit RemoveTappedToken(_token);
    }

    function _updateTappedToken(address _token, uint256 _tap) internal {
        taps[_token] = _tap;
        lastTapUpdates[_token] = getTimestamp();

        emit UpdateTappedToken(_token, _tap);
    }

    function _withdraw(address _token, uint256 _amount) internal {
        lastWithdrawals[_token] = getTimestamp();
        reserve.transfer(_token, beneficiary, _amount); // vault contract's transfer method already reverts on error

        emit Withdraw(_token, _amount);
    }
}
