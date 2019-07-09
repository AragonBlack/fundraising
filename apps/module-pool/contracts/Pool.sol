/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/apps-agent/contracts/Agent.sol";


// `Agent` is already an `AragonApp` [so `Pool` still is too]
// The `initialize` function is implemented in the Agent contract
contract Pool is Agent {
    bytes32 public constant SAFE_EXECUTE_ROLE = keccak256("SAFE_EXECUTE_ROLE");
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
    bytes32 public constant REMOVE_COLLATERAL_TOKEN_ROLE = keccak256("REMOVE_COLLATERAL_TOKEN_ROLE");

    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "POOL_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_ALREADY_EXISTS = "POOL_TOKEN_ALREADY_EXISTS";
    string private constant ERROR_TOKEN_DOES_NOT_EXIST = "POOL_TOKEN_DOES_NOT_EXIST";
    string private constant ERROR_TARGET_IS_GUARDED = "POOL_TARGET_IS_GUARDED";
    string private constant ERROR_BALANCE_NOT_CONSTANT = "POOL_BALANCE_NOT_CONSTANT";

    address[] public collateralTokens;

    event SafeExecute(address indexed sender, address indexed target, bytes data);
    event AddCollateralToken(address indexed token);
    event RemoveCollateralToken(address indexed token);

    /***** external functions *****/

    /**
    * @notice Safe execute '`@radspec(_target, _data)`' on `_target`
    * @param _target Address where the action is being executed
    * @param _data Calldata for the action
    * @return Exits call frame forwarding the return data of the executed call (either error or success data)
    */
    function safeExecute(address _target, bytes _data) external auth(SAFE_EXECUTE_ROLE) {
        uint256[] memory balances = new uint256[](collateralTokens.length);
        bytes32 size;
        bytes32 ptr;

        for (uint256 i = 0; i < collateralTokens.length; i++) {
            address token = collateralTokens[i];
            // we don't care if target is ETH [0x00...0] as it can't be spent anyhow [though you can't invoke anything at 0x00...0]
            require(_target != token || token == ETH, ERROR_TARGET_IS_GUARDED);
            balances[i] = balance(token);
        }

        bool result = _target.call(_data);

        assembly {
            size := returndatasize
            ptr := mload(0x40)
            // new "memory end"
            mstore(0x40, add(ptr, size))
            returndatacopy(ptr, 0, size)
        }

        if (result) {
            // if the underlying call has succeeded, check protected tokens' balances and return the call's return data
            for (uint256 j = 0; j < collateralTokens.length; j++) {
                require(balances[j] == balance(collateralTokens[j]), ERROR_BALANCE_NOT_CONSTANT);
            }

            emit SafeExecute(msg.sender, _target, _data);

            assembly {
                return(ptr, size)
            }
        } else {
            // if the underlying call has failed, revert and forward [possible] returned error data
            assembly {
                revert(ptr, size)
            }
        }
    }

    /**
    * @notice Add `_token.symbol(): string` as a collateral token to safeguard
    * @param _token Address of collateral token
    */
    function addCollateralToken(address _token) external auth(ADD_COLLATERAL_TOKEN_ROLE) {
        require(_token == ETH || isContract(_token), ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(!isTokenProtected(_token), ERROR_TOKEN_ALREADY_EXISTS);

        _addCollateralToken(_token);
    }

    /**
    * @notice Remove `_token.symbol(): string` as a collateral token to safeguard
    * @param _token Address of collateral token
    */
    function removeCollateralToken(address _token) external auth(REMOVE_COLLATERAL_TOKEN_ROLE) {
        require(isTokenProtected(_token), ERROR_TOKEN_DOES_NOT_EXIST);

      _removeCollateralToken(_token);
    }

    /***** public functions *****/

    function isTokenProtected(address _token) public view returns (bool) {
        for (uint256 i = 0; i < collateralTokens.length; i++) {
            if (collateralTokens[i] == _token) {
                return true;
            }
        }

        return false;
    }

    function collateralTokenIndex(address _token) public view returns (uint256) {
        for (uint i = 0; i < collateralTokens.length; i++) {
            if (collateralTokens[i] == _token) {
              return i;
            }
        }

        revert(ERROR_TOKEN_DOES_NOT_EXIST);
    }

    /***** internal functions *****/

    function _addCollateralToken(address _token) internal {
        collateralTokens.push(_token);

        emit AddCollateralToken(_token);
    }

    function _removeCollateralToken(address _token) internal {
        collateralTokens[collateralTokenIndex(_token)] = collateralTokens[collateralTokens.length - 1];
        delete collateralTokens[collateralTokens.length - 1];
        collateralTokens.length --;

        emit RemoveCollateralToken(_token);
    }
}
