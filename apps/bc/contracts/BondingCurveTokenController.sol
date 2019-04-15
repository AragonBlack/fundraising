/*
 * SPDX-License-Identitifer:    GPL-3.0-or-later
 */

/* solium-disable function-order */

pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IForwarder.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";

import "@aragon/apps-shared-minime/contracts/ITokenController.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";


contract TokenManager is ITokenController, IForwarder, AragonApp {
    using SafeMath for uint256;

    bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
    bytes32 public constant ISSUE_ROLE = keccak256("ISSUE_ROLE");
    bytes32 public constant ASSIGN_ROLE = keccak256("ASSIGN_ROLE");
    bytes32 public constant REVOKE_VESTINGS_ROLE = keccak256("REVOKE_VESTINGS_ROLE");
    bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");

    uint256 public constant MAX_VESTINGS_PER_ADDRESS = 50;

    string private constant ERROR_CALLER_NOT_TOKEN = "BCTM_CALLER_NOT_TOKEN";
    string private constant ERROR_NO_VESTING = "TM_NO_VESTING";
    string private constant ERROR_TOKEN_CONTROLLER = "BCTM_TOKEN_CONTROLLER";
    string private constant ERROR_MINT_RECEIVER_IS_TM = "TM_MINT_RECEIVER_IS_TM";
    string private constant ERROR_VESTING_TO_TM = "TM_VESTING_TO_TM";
    string private constant ERROR_TOO_MANY_VESTINGS = "TM_TOO_MANY_VESTINGS";
    string private constant ERROR_WRONG_CLIFF_DATE = "TM_WRONG_CLIFF_DATE";
    string private constant ERROR_VESTING_NOT_REVOKABLE = "TM_VESTING_NOT_REVOKABLE";
    string private constant ERROR_REVOKE_TRANSFER_FROM_REVERTED = "TM_REVOKE_TRANSFER_FROM_REVERTED";
    string private constant ERROR_CAN_NOT_FORWARD = "TM_CAN_NOT_FORWARD";
    string private constant ERROR_BALANCE_INCREASE_NOT_ALLOWED = "TM_BALANCE_INC_NOT_ALLOWED";
    string private constant ERROR_ASSIGN_TRANSFER_FROM_REVERTED = "TM_ASSIGN_TRANSFER_FROM_REVERTED";


    // Note that we COMPLETELY trust this MiniMeToken to not be malicious for proper operation of this contract
    MiniMeToken public token;
    uint256 public maxAccountTokens;

    modifier onlyToken() {
        require(msg.sender == address(token), ERROR_CALLER_NOT_TOKEN);
        _;
    }

    /**
    * @notice Initialize Bonding Curve Token Manager for `_token.symbol(): string`, whose tokens are `_transferable ? 'not' : ''` transferable.
    * @param _token MiniMeToken address for the managed token (Bonding Curve Token Manager instance must be already set as the token controller).
    * @param _transferable whether the token can be transferred by holders.
    */
    function initialize(MiniMeToken _token, bool _transferable) external onlyInit {
        initialized();

        require(_token.controller() == address(this), ERROR_TOKEN_CONTROLLER);

        token = _token;

        if (token.transfersEnabled() != _transferable) {
            token.enableTransfers(_transferable);
        }
    }

    /***** ITokenController functions  *****/ 
    /**
        `onTransfer()`, `onApprove()`, and `proxyPayment()` are callbacks from the MiniMe token
        contract and are only meant to be called through the managed MiniMe token that gets assigned
        during initialization.
    */

    /**
        @dev Notifies the controller about a token transfer allowing the controller to decide whether
             to allow it or react if desired (only callable from the token).
             Initialization check is implicitly provided by `onlyToken()`.
        @param _from The origin of the transfer
        @param _to The destination of the transfer
        @param _amount The amount of the transfer
        @return False if the controller does not authorize the transfer
    */
    function onTransfer(address _from, address _to, uint256 _amount) external onlyToken returns (bool) {
        return true; // MiniMeToken already checks whether transfers are enable or not
    }

    /**
        * @dev Notifies the controller about an approval allowing the controller to react if desired
        *      Initialization check is implicitly provided by `onlyToken()`.
        * @return False if the controller does not authorize the approval
    */
    function onApprove(address, address, uint) external onlyToken returns (bool) {
        return true;
    }

    /**
        * @dev Called when ether is sent to the MiniMe Token contract
        *      Initialization check is implicitly provided by `onlyToken()`.
        * @return True if the ether is accepted, false for it to throw
    */
    function proxyPayment(address) external payable onlyToken returns (bool) {
        return false;
    }

    /***** forwarding functions *****/

    function isForwarder() external pure returns (bool) {
        return true;
    }

    /**
    ** CHECK IF WE SHOULD ALLOW FORWARDING ACTIONS. IT COULD ALSO USERS TO EMPTY THE POOL / SO WE SHOULD ADD THE POOL ADDRESS TO THE BLACKLIST
    * @notice Execute desired action as a token holder
    * @dev IForwarder interface conformance. Forwards any token holder action.
    * @param _evmScript Script being executed
    */
    function forward(bytes _evmScript) public {
        require(canForward(msg.sender, _evmScript), ERROR_CAN_NOT_FORWARD);
        bytes memory input = new bytes(0); // TODO: Consider input for this

        // Add the managed token to the blacklist to disallow a token holder from executing actions
        // on the token controller's (this contract) behalf
        address[] memory blacklist = new address[](1);
        blacklist[0] = address(token);

        runScript(_evmScript, input, blacklist);
    }

    function canForward(address _sender, bytes) public view returns (bool) {
        return hasInitialized() && token.balanceOf(_sender) > 0;
    }


    /**
        CHECK TAHT FGUNCTION DEEPER
    * @dev Disable recovery escape hatch for own token,
    *      as the it has the concept of issuing tokens without assigning them
    */
    function allowRecoverability(address _token) public view returns (bool) {
        return _token != address(token);
    }

    /***** internal functions *****/

    function _mint(address _receiver, uint256 _amount) internal {
        token.generateTokens(_receiver, _amount); // minime.generateTokens() never returns false
    }

    function _burn(address _holder, uint256 _amount) internal {
        token.destroyTokens(_holder, _amount); // minime.destroyTokens() never returns false, only reverts on failure
    }
}