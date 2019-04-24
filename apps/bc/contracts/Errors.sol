pragma solidity 0.4.24;

import "./IErrors.sol";

contract Errors is IErrors {
    string public constant ERROR_INVALID_INIT_PARAMETER = "BC_INVALID_INIT_PARAMETER";
    string public constant ERROR_NOT_COLLATERAL_TOKEN = "BC_NOT_COLLATERAL_TOKEN";
    string public constant ERROR_TRANSFER_FAILED = "BC_TRANSER_FAILED";
    string public constant ERROR_BATCH_NOT_CLEARED = "BC_BATCH_NOT_CLEARED";
    string public constant ERROR_ALREADY_CLAIMED = "BC_ALREADY_CLAIMED";
    string public constant ERROR_BUY_OR_SELL_ZERO = "BC_BUY_OR_SELL_ZERO";
    string public constant ERROR_INSUFFICIENT_FUNDS = "BC_INSUFFICIENT_FUNDS";
    string public constant ERROR_GAS_COST_BUY_INSUFFICIENT = "BC_GAS_COST_BUY_INSUFFICIENT";
    string public constant ERROR_GAS_COST_SELL_INSUFFICIENT = "BC_GAS_COST_SELL_INSUFFICIENT";
}