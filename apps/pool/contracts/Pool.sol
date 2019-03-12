/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/apps-agent/contracts/Agent.sol";


contract Pool is Agent {
    bytes32 public constant SAFE_EXECUTE_ROLE = keccak256("SAFE_EXECUTE_ROLE");
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant REMOVE_COLLATERAL_TOKEN_ROLE = keccak256("REMOVE_COLLATERAL_TOKEN_ROLE");

    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "POOL_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_ALREADY_EXISTS = "POOL_TOKEN_ALREADY_EXISTS";
    string private constant ERROR_TOKEN_DOES_NOT_EXIST = "POOL_TOKEN_DOES_NOT_EXIST";

    mapping (uint256 => address) public collateralTokens;
    uint256 public collateralTokensLength;

    event AddCollateralToken(address indexed token);
    event RemoveCollateralToken(address indexed token);

    /***** external functions *****/

    function safeExecute(address _target, uint256 _ethValue, bytes _data)
        external // This function MUST always be external as the function performs a low level return, exiting the Agent app execution context
        authP(SAFE_EXECUTE_ROLE, arr(_target, _ethValue, uint256(getSig(_data)))) // bytes4 casted as uint256 sets the bytes as the LSBs
    {
        /* execute(_target, _ethValue, _data); */
    }

    function addCollateralToken(address _token) external auth(ADD_COLLATERAL_TOKEN_ROLE) {
        require(_token == ETH || isContract(_token), ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(collateralTokenIndex(_token) == 0, ERROR_TOKEN_ALREADY_EXISTS);

        _addCollateralToken(_token);
    }

    function removeCollateralToken(address _token) external auth(REMOVE_COLLATERAL_TOKEN_ROLE) {
      uint256 index = collateralTokenIndex(_token);
      require(index != 0, ERROR_TOKEN_DOES_NOT_EXIST);

      _removeCollateralToken(index, _token);
    }

    /***** public functions *****/

    function collateralTokenIndex(address _token) public view returns (uint256) {
        for (uint i = 1; i <= collateralTokensLength; i++) {
            if (collateralTokens[i] == _token) {
              return i;
            }
        }

        return uint256(0);
    }

    /***** private functions *****/

    function _addCollateralToken(address _token) private {
        collateralTokensLength = collateralTokensLength + 1;
        collateralTokens[collateralTokensLength] = _token;

        emit AddCollateralToken(_token);
    }

    function _removeCollateralToken(uint256 _index, address _token) private {
        delete collateralTokens[_index];
        collateralTokens[_index] = collateralTokens[collateralTokensLength];
        collateralTokensLength = collateralTokensLength - 1;

        emit RemoveCollateralToken(_token);
    }
}
