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
    string private constant ERROR_TARGET_IS_COLLATERAL_TOKEN = "POOL_TARGET_IS_COLLATERAL_TOKEN";
    string private constant ERROR_TOKEN_BALANCE_NOT_CONSTANT = "POOL_TOKEN_BALANCE_NOT_CONSTANT";


    mapping (uint256 => address) public collateralTokens;
    uint256 public collateralTokensLength;

    event SafeExecute(address indexed sender, address indexed target, bytes data);
    event AddCollateralToken(address indexed token);
    event RemoveCollateralToken(address indexed token);

    /***** external functions *****/

    // Forbid any actions on the collateralized token (blacklist the target address)
    // PLus check the balance to make sure there has been no approved transferFrom
    // The only thing that it prevents which could not be a security feature would
    // be a call to transferFrom for which I see no immediate use-case
    // This function MUST always be external as the function performs a low level return, exiting the Agent app execution context
    function safeExecute(address _target, bytes _data) external auth(SAFE_EXECUTE_ROLE) {
        uint256[] memory balances = new uint256[](collateralTokensLength);
        bytes32 size;
        bytes32 ptr;

        for (uint256 i = 0; i < collateralTokensLength; i++) {
            address token = collateralTokens[i + 1];
            if(token != ETH && token == _target) revert(ERROR_TARGET_IS_COLLATERAL_TOKEN); // we don't care if token is ETH as it can't be spent
            balances[i] = balance(token);
        }

        bool result = _target.call(_data);

        assembly {
            size := returndatasize
            ptr := mload(0x40)
            // new "memory end" including padding
            mstore(0x40, add(ptr, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            returndatacopy(ptr, 0, size)
        }

        if (result) {
          for (uint256 j = 0; j < collateralTokensLength; j++) {
              require(balances[j] == balance(collateralTokens[j + 1]), ERROR_TOKEN_BALANCE_NOT_CONSTANT);
          }
            emit SafeExecute(msg.sender, _target, _data);
        }

        assembly {
            // revert instead of invalid() bc if the underlying call failed with invalid() it already wasted gas.
            // if the call returned error data, forward it
            switch result case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
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

    /***** internal functions *****/

    function _addCollateralToken(address _token) internal {
        collateralTokensLength = collateralTokensLength + 1;
        collateralTokens[collateralTokensLength] = _token;

        emit AddCollateralToken(_token);
    }

    function _removeCollateralToken(uint256 _index, address _token) internal {
        delete collateralTokens[_index];
        collateralTokens[_index] = collateralTokens[collateralTokensLength];
        collateralTokensLength = collateralTokensLength - 1;

        emit RemoveCollateralToken(_token);
    }
}
