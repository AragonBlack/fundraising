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

import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragonblack/fundraising-pool/contracts/Pool.sol";


contract Tap is EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;

    uint64 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18

    bytes32 public constant ADD_TOKEN_TAP_ROLE = keccak256("ADD_TOKEN_TAP_ROLE");
    bytes32 public constant REMOVE_TOKEN_TAP_ROLE = keccak256("REMOVE_TOKEN_TAP_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant UPDATE_POOL_ROLE = keccak256("UPDATE_POOL_ROLE");
    bytes32 public constant UPDATE_VAULT_ROLE = keccak256("UPDATE_VAULT_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    string private constant ERROR_POOL_NOT_CONTRACT = "TAP_POOL_NOT_CONTRACT";
    string private constant ERROR_VAULT_NOT_CONTRACT = "TAP_VAULT_NOT_CONTRACT";
    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "TAP_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_TAP_ALREADY_EXISTS = "TAP_TOKEN_TAP_ALREADY_EXISTS";
    string private constant ERROR_TOKEN_TAP_DOES_NOT_EXIST = "TAP_TOKEN_TAP_DOES_NOT_EXIST";
    string private constant ERROR_TAP_RATE_ZERO = "TAP_TAP_RATE_ZERO";
    string private constant ERROR_WITHDRAWAL_VALUE_ZERO = "TAP_WITHDRAWAL_VALUE_ZERO";
    string private constant ERROR_TAP_RATE_NOT_PERCENTAGE = "TAP_RATE_NOT_PERCENTAGE";
    string private constant ERROR_UPDATE_TAP_RATE_EXCEEDS_LIMIT = "TAP_RATE_EXCEEDS_MONTHLY_LIMIT";

    Pool public pool;
    Vault public vault;

    mapping (address => uint256) public taps;
    mapping (address => uint256) public lastWithdrawals;
    mapping (address => uint256) public lastTapUpdate;
    uint256 public tapRate;

    event AddTokenTap(address indexed token, uint256 tap);
    event RemoveTokenTap(address indexed token);
    event UpdateTokenTap(address indexed token, uint256 tap);
    event UpdatePool(address pool);
    event UpdateVault(address vault);
    event Withdraw(address indexed token, uint256 value);

    function initialize(Pool _pool, Vault _vault, uint256 _monthlyTapRate ) public onlyInit {
        initialized();

        require(isContract(_pool), ERROR_POOL_NOT_CONTRACT);
        require(isContract(_vault), ERROR_VAULT_NOT_CONTRACT);
        require(_monthlyTapRate < PCT_BASE,  ERROR_TAP_RATE_NOT_PERCENTAGE);

        pool = _pool;
        vault = _vault;
        tapRate = _monthlyTapRate;
    }

    /***** external function *****/
    function addTokenTap(address _token, uint256 _tap) external auth(ADD_TOKEN_TAP_ROLE) {
        require(_token == ETH || isContract(_token), ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(taps[_token] == uint256(0), ERROR_TOKEN_TAP_ALREADY_EXISTS);
        require(_tap > 0, ERROR_TAP_RATE_ZERO);

        _addTokenTap(_token, _tap);
    }

    function removeTokenTap(address _token) external auth(REMOVE_TOKEN_TAP_ROLE) {
        require(taps[_token] != uint256(0), ERROR_TOKEN_TAP_DOES_NOT_EXIST);

        _removeTokenTap(_token);
    }

    function updateTokenTap(address _token, uint256 _tap) external auth(UPDATE_TOKEN_TAP_ROLE) {
        require(taps[_token] != uint256(0), ERROR_TOKEN_TAP_DOES_NOT_EXIST);
        require(_tap > 0, ERROR_TAP_RATE_ZERO);

        if (lastTapUpdate[_token] != uint256(0)) {
          uint256 diff = (now).sub(lastTapUpdate[_token]);
          //Verify that within the 30-day period since last update it increases no more than the fixed percentage
          if (diff.div(60).div(60).div(24) < 30) {
            require(!_isValuePct(_tap, taps[_token], tapRate), ERROR_UPDATE_TAP_RATE_EXCEEDS_LIMIT);
          }
        }

        _updateTokenTap(_token, _tap);
    }

    function updatePool(Pool _pool) external auth(UPDATE_POOL_ROLE) {
        require(isContract(_pool), ERROR_POOL_NOT_CONTRACT);

        _updatePool(_pool);
    }

    function updateVault(Vault _vault) external auth(UPDATE_VAULT_ROLE) {
        require(isContract(_vault), ERROR_VAULT_NOT_CONTRACT);

        _updateVault(_vault);
    }

    function withdraw(address _token) external auth(WITHDRAW_ROLE) {
        require(taps[_token] > 0, ERROR_TOKEN_TAP_DOES_NOT_EXIST);
        uint256 value = getWithdrawalValue(_token);
        require(value > 0, ERROR_WITHDRAWAL_VALUE_ZERO);

        _withdraw(_token, value);
    }

    /***** public functions *****/

    function poolBalance(address _token) public view isInitialized returns (uint256) {
        if (_token == ETH) {
            return address(pool).balance;
        } else {
            return ERC20(_token).staticBalanceOf(pool);
        }
    }

    function getWithdrawalValue(address _token) public view isInitialized returns (uint256) {
        uint256 balance = poolBalance(_token);
        uint256 max = (now.sub(lastWithdrawals[_token])).mul(taps[_token]);
        return max > balance ? balance : max;
    }

    function getMonthlyTapRate() public view isInitialized returns (uint256) {
      return tapRate;
    }

    /***** internal functions *****/

    function _addTokenTap(address _token, uint256 _tap) internal {
        taps[_token] = _tap;
        lastWithdrawals[_token] = now;

        emit AddTokenTap(_token, _tap);
    }

    function _removeTokenTap(address _token) internal {
        taps[_token] = uint256(0);
        // no need to re-initialize lastWithdrawals[_token] as it
        // will be automatically updated if the token is re-added
        emit RemoveTokenTap(_token);
    }

    function _updateTokenTap(address _token, uint256 _tap) internal {
        taps[_token] = _tap;
        lastTapUpdate[_token] = now;

        emit UpdateTokenTap(_token, _tap);
    }

    function _updatePool(Pool _pool) internal {
        pool = _pool;

        emit UpdatePool(address(_pool));
    }

    function _updateVault(Vault _vault) internal {
        vault = _vault;

        emit UpdateVault(address(_vault));
    }

    function _withdraw(address _token, uint256 _value) internal {
        lastWithdrawals[_token] = now;
        pool.transfer(_token, vault, _value); // Pool / Agent / Vault contacts transfer method already throws on error

        emit Withdraw(_token, _value);
    }

    /**
    * https://github.com/aragon/aragon-apps/blob/98c1e387c82e634da47ea7cefde5ffdf54a5b432/apps/voting/contracts/Voting.sol#L344
    * @dev Calculates whether `_value` is more than a percentage `_pct` of `_total`
    */
    function _isValuePct(uint256 _value, uint256 _total, uint256 _pct) internal pure returns (bool) {
        if (_total == 0) {
            return false;
        }

        uint256 computedPct = _value.mul(PCT_BASE) / _total;
        return computedPct > _pct;
    }
}
