/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";

import "@aragon/apps-finance/contracts/Finance.sol";

import "@aragonblack/fundraising-pool/contracts/Pool.sol";


contract Tap is EtherTokenConstant, IsContract, AragonApp {
    bytes32 public constant ADD_TOKEN_ROLE = keccak256("ADD_TOKEN_ROLE");
    bytes32 public constant REMOVE_TOKEN_ROLE = keccak256("REMOVE_TOKEN_ROLE");
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
    bytes32 public constant UPDATE_POOL_ROLE = keccak256("UPDATE_POOL_ROLE");
    bytes32 public constant UPDATE_FINANCE_ROLE = keccak256("UPDATE_FINANCE_ROLE");

    string private constant ERROR_POOL_NOT_CONTRACT = "TAP_POOL_NOT_CONTRACT";
    string private constant ERROR_FINANCE_NOT_CONTRACT = "TAP_FINANCE_NOT_CONTRACT";
    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "TAP_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_ALREADY_EXISTS = "TAP_TOKEN_ALREADY_EXISTS";
    string private constant ERROR_TOKEN_DOES_NOT_EXIST = "TAP_TOKEN_DOES_NOT_EXIST";
    string private constant ERROR_TAP_RATE_ZERO = "TAP_TAP_RATE_ZERO";

    Pool public pool;
    Finance public finance;

    mapping (address => uint256) public taps;
    mapping (address => uint256) public lastWithdrawals;

    event AddToken(address indexed token, uint256 tap);
    event RemoveToken(address indexed token);
    event UpdateTokenTap(address indexed token, uint256 tap);
    event UpdatePool(address pool);
    event UpdateFinance(address finance);

    function initialize(Pool _pool, Finance _finance) onlyInit {
        initialized();

        require(isContract(_pool), ERROR_POOL_NOT_CONTRACT);
        require(isContract(_finance), ERROR_FINANCE_NOT_CONTRACT);

        pool = _pool;
        finance = _finance;
    }

    /***** external function *****/

    function addToken(address _token, uint256 _tap) external auth(ADD_TOKEN_ROLE) {
        require(_token == ETH || isContract(_token), ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(taps[_token] == uint256(0), ERROR_TOKEN_ALREADY_EXISTS);
        require(_tap > 0, ERROR_TAP_RATE_ZERO);

        _addToken(_token, _tap);
    }

    function removeToken(address _token) external auth(REMOVE_TOKEN_ROLE) {
        require(taps[_token] != uint256(0), ERROR_TOKEN_DOES_NOT_EXIST);

        _removeToken(_token);
    }

    function updateTokenTap(address _token, uint256 _tap) external auth(UPDATE_TOKEN_TAP_ROLE) {
        require(taps[_token] != uint256(0), ERROR_TOKEN_DOES_NOT_EXIST);
        require(_tap > 0, ERROR_TAP_RATE_ZERO);

        _updateTokenTap(_token, _tap);
    }

    function updatePool(Pool _pool) external auth(UPDATE_POOL_ROLE) {
        require(isContract(_pool), ERROR_POOL_NOT_CONTRACT);

        _updatePool(_pool);
    }

    function updateFinance(Finance _finance) external auth(UPDATE_FINANCE_ROLE) {
        require(isContract(_finance), ERROR_FINANCE_NOT_CONTRACT);

        _updateFinance(_finance);
    }

    /***** internal functions *****/

    function _addToken(address _token, uint256 _tap) internal {
        taps[_token] = _tap;

        emit AddToken(_token, _tap);
    }

    function _removeToken(address _token) internal {
        taps[_token] = uint256(0);

        emit RemoveToken(_token);
    }

    function _updateTokenTap(address _token, uint256 _tap) internal {
        taps[_token] = _tap;

        emit UpdateTokenTap(_token, _tap);
    }



    function _updatePool(Pool _pool) internal {
        pool = _pool;

        emit UpdatePool(address(_pool));
    }

    function _updateFinance(Finance _finance) internal {
        finance = _finance;

        emit UpdateFinance(address(_finance));
    }




}
