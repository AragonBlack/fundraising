/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

pragma solidity 0.4.24;

import "@aragon/apps-agent/contracts/Agent.sol";


/*
 * NOTE: `Agent` is already an `AragonApp` [so `Pool` is too]
 * NOTE: the `initialize` function is implemented in the Agent contract
*/

contract Pool is Agent {
    /* Hardcoded constants to save gas
    bytes32 public constant SAFE_EXECUTE_ROLE = keccak256("SAFE_EXECUTE_ROLE");
    bytes32 public constant ADD_PROTECTED_TOKEN_ROLE = keccak256("ADD_PROTECTED_TOKEN_ROLE");
    bytes32 public constant REMOVE_PROTECTED_TOKEN_ROLE = keccak256("REMOVE_PROTECTED_TOKEN_ROLE");
    */
    bytes32 public constant SAFE_EXECUTE_ROLE = 0x0a1ad7b87f5846153c6d5a1f761d71c7d0cfd122384f56066cd33239b7933694;
    bytes32 public constant ADD_PROTECTED_TOKEN_ROLE = 0x6eb2a499556bfa2872f5aa15812b956cc4a71b4d64eb3553f7073c7e41415aaa;
    bytes32 public constant REMOVE_PROTECTED_TOKEN_ROLE = 0x71eee93d500f6f065e38b27d242a756466a00a52a1dbcd6b4260f01a8640402a;

    string private constant ERROR_TOKENS_CAP_REACHED = "POOL_TOKENS_CAP_REACHED";
    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "POOL_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_ALREADY_PROTECTED = "POOL_TOKEN_ALREADY_PROTECTED";
    string private constant ERROR_TOKEN_NOT_PROTECTED = "POOL_TOKEN_NOT_PROTECTED";
    string private constant ERROR_TARGET_PROTECTED = "POOL_TARGET_PROTECTED";
    string private constant ERROR_PROTECTED_TOKENS_MODIFIED = "POOL_PROTECTED_TOKENS_MODIFIED";
    string private constant ERROR_BALANCE_NOT_CONSTANT = "POOL_BALANCE_NOT_CONSTANT";

    uint256 public constant PROTECTED_TOKENS_CAP = 10;
    address[] public protectedTokens;

    event SafeExecute(address indexed sender, address indexed target, bytes data);
    event AddProtectedToken(address indexed token);
    event RemoveProtectedToken(address indexed token);

    /***** external functions *****/

    /**
     * @notice Safe execute '`@radspec(_target, _data)`' on `_target`
     * @param _target Address where the action is to be executed
     * @param _data Calldata for the action to be executed
     * @return Exits call frame forwarding the return data of the executed call [either error or success data]
    */
    function safeExecute(address _target, bytes _data) external auth(SAFE_EXECUTE_ROLE) {
        address[] memory _protectedTokens = new address[](protectedTokens.length);
        uint256[] memory balances = new uint256[](protectedTokens.length);
        bytes32 size;
        bytes32 ptr;

        for (uint256 i = 0; i < protectedTokens.length; i++) {
            address token = protectedTokens[i];
            // we don't care if target is ETH [0x00...0] as it can't be spent anyhow [though you can't invoke anything at 0x00...0]
            require(_target != token || token == ETH, ERROR_TARGET_PROTECTED);
            // we copy the protected tokens array to check whether the storage array has been modified during the underlying call
            _protectedTokens[i] = token;
            // we copy the balances to check whether they have been modified during the underlying call
            balances[i] = balance(token);
        }

        bool result = _target.call(_data);

        assembly {
            size := returndatasize
            ptr := mload(0x40)
            mstore(0x40, add(ptr, size))
            returndatacopy(ptr, 0, size)
        }

        if (result) {
            // if the underlying call has succeeded, we check that the protected tokens
            // and their balances have not been modified and return the call's return data
            for (uint256 j = 0; j < _protectedTokens.length; j++) {
                require(protectedTokens[j] == _protectedTokens[j], ERROR_PROTECTED_TOKENS_MODIFIED);
                require(balances[j] == balance(_protectedTokens[j]), ERROR_BALANCE_NOT_CONSTANT);
            }

            emit SafeExecute(msg.sender, _target, _data);

            assembly {
                return(ptr, size)
            }
        } else {
            // if the underlying call has failed, we revert and forward [possible] returned error data
            assembly {
                revert(ptr, size)
            }
        }
    }

    /**
     * @notice Add `_token.symbol(): string` to the list of protected tokens
     * @param _token Address of the token to be protected
    */
    function addProtectedToken(address _token) external auth(ADD_PROTECTED_TOKEN_ROLE) {
        require(protectedTokens.length < PROTECTED_TOKENS_CAP, ERROR_TOKENS_CAP_REACHED);
        require(isContract(_token) || _token == ETH, ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(!tokenIsProtected(_token), ERROR_TOKEN_ALREADY_PROTECTED);

        _addProtectedToken(_token);
    }

    /**
     * @notice Remove `_token.symbol(): string` from the list of protected tokens
     * @param _token Address of the token to be unprotected
    */
    function removeProtectedToken(address _token) external auth(REMOVE_PROTECTED_TOKEN_ROLE) {
        require(tokenIsProtected(_token), ERROR_TOKEN_NOT_PROTECTED);

      _removeProtectedToken(_token);
    }

    /***** public functions *****/

    function tokenIsProtected(address _token) public view isInitialized returns (bool) {
        for (uint256 i = 0; i < protectedTokens.length; i++) {
            if (protectedTokens[i] == _token) {
                return true;
            }
        }

        return false;
    }

    function protectedTokenIndex(address _token) public view isInitialized returns (uint256) {
        for (uint i = 0; i < protectedTokens.length; i++) {
            if (protectedTokens[i] == _token) {
              return i;
            }
        }

        revert(ERROR_TOKEN_NOT_PROTECTED);
    }

    /***** internal functions *****/

    function _addProtectedToken(address _token) internal {
        protectedTokens.push(_token);

        emit AddProtectedToken(_token);
    }

    function _removeProtectedToken(address _token) internal {
        protectedTokens[protectedTokenIndex(_token)] = protectedTokens[protectedTokens.length - 1];
        delete protectedTokens[protectedTokens.length - 1];
        protectedTokens.length --;

        emit RemoveProtectedToken(_token);
    }
}
