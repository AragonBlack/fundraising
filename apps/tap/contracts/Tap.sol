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
import "@ablack/fundraising-shared-interfaces/contracts/IMarketMakerController.sol";


contract Tap is TimeHelpers, EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20 for ERC20;
    using SafeMath for uint256;
    /* Hardcoded constants to save gas
    bytes32 public constant UPDATE_CONTROLLER_ROLE = keccak256("UPDATE_CONTROLLER_ROLE");
    bytes32 public constant UPDATE_RESERVE_ROLE = keccak256("UPDATE_RESERVE_ROLE");
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = keccak256("UPDATE_BENEFICIARY_ROLE");
    bytes32 public constant UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE = keccak256("UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE");
    bytes32 public constant ADD_TAPPED_TOKEN_ROLE = keccak256("ADD_TAPPED_TOKEN_ROLE");
    bytes32 public constant REMOVE_TAPPED_TOKEN_ROLE = keccak256("REMOVE_TAPPED_TOKEN_ROLE");
    bytes32 public constant UPDATE_TAPPED_TOKEN_ROLE = keccak256("UPDATE_TAPPED_TOKEN_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");
    */
    bytes32 public constant UPDATE_CONTROLLER_ROLE = 0x454b5d0dbb74f012faf1d3722ea441689f97dc957dd3ca5335b4969586e5dc30;
    bytes32 public constant UPDATE_RESERVE_ROLE = 0x7984c050833e1db850f5aa7476710412fd2983fcec34da049502835ad7aed4f7;
    bytes32 public constant UPDATE_BENEFICIARY_ROLE = 0xf7ea2b80c7b6a2cab2c11d2290cb005c3748397358a25e17113658c83b732593;
    bytes32 public constant UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE = 0x568011701fb830cea21c0d7c56aef68ffd80cfdd79c0e3c46844d9b8a725cf38;
    bytes32 public constant ADD_TAPPED_TOKEN_ROLE = 0x5bc3b608e6be93b75a1c472a4a5bea3d31eabae46bf968e4bc4c7701562114dc;
    bytes32 public constant REMOVE_TAPPED_TOKEN_ROLE = 0xd76960be78bfedc5b40ce4fa64a2f8308f39dd2cbb1f9676dbc4ce87b817befd;
    bytes32 public constant UPDATE_TAPPED_TOKEN_ROLE = 0x83201394534c53ae0b4696fd49a933082d3e0525aa5a3d0a14a2f51e12213288;
    bytes32 public constant WITHDRAW_ROLE = 0x5d8e12c39142ff96d79d04d15d1ba1269e4fe57bb9d26f43523628b34ba108ec;

    uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18

    string private constant ERROR_CONTRACT_IS_EOA = "TAP_CONTRACT_IS_EOA";
    string private constant ERROR_INVALID_BENEFICIARY = "TAP_INVALID_BENEFICIARY";
    string private constant ERROR_BATCH_BLOCKS_ZERO = "TAP_BATCH_BLOCKS_ZERO";
    string private constant ERROR_TOKEN_NOT_ETH_OR_CONTRACT = "TAP_TOKEN_NOT_ETH_OR_CONTRACT";
    string private constant ERROR_TOKEN_ALREADY_TAPPED = "TAP_TOKEN_ALREADY_TAPPED";
    string private constant ERROR_TOKEN_NOT_TAPPED = "TAP_TOKEN_NOT_TAPPED";
    string private constant ERROR_TAP_RATE_ZERO = "TAP_TAP_RATE_ZERO";
    string private constant ERROR_INVALID_TAP_UPDATE = "TAP_INVALID_TAP_UPDATE";
    string private constant ERROR_WITHDRAWAL_AMOUNT_ZERO = "TAP_WITHDRAWAL_AMOUNT_ZERO";

    IMarketMakerController public controller;
    Vault                  public reserve;
    address                public beneficiary;
    uint256                public batchBlocks;
    uint256                public maximumTapIncreasePct; // expressed in PCT_BASE

    mapping (address => uint256) public taps;
    mapping (address => uint256) public floors;
    mapping (address => uint256) public lastWithdrawals;
    mapping (address => uint256) public lastTapUpdates;

    event UpdateController(address indexed controller);
    event UpdateReserve(address indexed reserve);
    event UpdateBeneficiary(address indexed beneficiary);
    event UpdateMaximumTapIncreasePct(uint256 maximumTapIncreasePct);
    event AddTappedToken(address indexed token, uint256 tap, uint256 floor);
    event RemoveTappedToken(address indexed token);
    event UpdateTappedToken(address indexed token, uint256 tap, uint256 floor);
    event Withdraw(address indexed token, uint256 amount);


    /***** external function *****/

    function initialize(
        IMarketMakerController _controller,
        Vault _reserve,
        address _beneficiary,
        uint256 _batchBlocks,
        uint256 _maximumTapIncreasePct
    )
        external onlyInit
    {
        require(isContract(_controller), ERROR_CONTRACT_IS_EOA);
        require(isContract(_reserve), ERROR_CONTRACT_IS_EOA);
        require(_beneficiaryIsValid(_beneficiary), ERROR_INVALID_BENEFICIARY);
        require(_batchBlocks != 0, ERROR_BATCH_BLOCKS_ZERO);

        initialized();
        controller = _controller;
        reserve = _reserve;
        beneficiary = _beneficiary;
        batchBlocks = _batchBlocks;
        maximumTapIncreasePct = _maximumTapIncreasePct;
    }

    /**
     * @notice Update controller to `_controller`
     * @param _controller The address of the new controller
    */
    function updateController(IMarketMakerController _controller) external auth(UPDATE_CONTROLLER_ROLE) {
        require(isContract(_controller), ERROR_CONTRACT_IS_EOA);

        _updateController(_controller);
    }

    /**
     * @notice Update the reserve to `_reserve`
     * @param _reserve The address of the new reserve to be used
    */
    function updateReserve(Vault _reserve) external auth(UPDATE_RESERVE_ROLE) {
        require(isContract(_reserve), ERROR_CONTRACT_IS_EOA);

        _updateReserve(_reserve);
    }

    /**
     * @notice Update the beneficiary to `_beneficiary`
     * @param _beneficiary The address of the new beneficiary to be used
    */
    function updateBeneficiary(address _beneficiary) external auth(UPDATE_BENEFICIARY_ROLE) {
        require(_beneficiaryIsValid(_beneficiary), ERROR_INVALID_BENEFICIARY);

        _updateBeneficiary(_beneficiary);
    }

    /**
     * @notice Update maximum tap increase percentage to `@formatPct(_maximumTapIncreasePct)`%
     * @param _maximumTapIncreasePct The new maximum tap increase percentage to be used
    */
    function updateMaximumTapIncreasePct(uint256 _maximumTapIncreasePct) external auth(UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE) {
        _updateMaximumTapIncreasePct(_maximumTapIncreasePct);
    }

    /**
     * @notice Add tap for `_token.symbol(): string` with a pace of `@tokenAmount(_token, _tap)` per block and a floor of `@tokenAmount(_token, _floor)`
     * @param _token The address of the token to be tapped
     * @param _tap The tap to be applied to that token [in wei / block]
     * @param _floor The floor to be applied to that token

    */
    function addTappedToken(address _token, uint256 _tap, uint256 _floor) external auth(ADD_TAPPED_TOKEN_ROLE) {
        require(_tokenIsETHOrContract(_token), ERROR_TOKEN_NOT_ETH_OR_CONTRACT);
        require(!_tokenIsTapped(_token), ERROR_TOKEN_ALREADY_TAPPED);
        require(_tapRateIsNotZero(_tap), ERROR_TAP_RATE_ZERO);

        _addTappedToken(_token, _tap, _floor);
    }

    /**
     * @notice Remove tap for `_token.symbol(): string`
     * @param _token The address of the token to be un-tapped
    */
    function removeTappedToken(address _token) external auth(REMOVE_TAPPED_TOKEN_ROLE) {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);

        _removeTappedToken(_token);
    }

    /**
     * @notice Update tap for `_token.symbol(): string` with a pace of `@tokenAmount(_token, _tap)` per block and a floor of `@tokenAmount(_token, _floor)`
     * @param _token The address of the token whose tap and floor are to be updated
     * @param _tap The new tap to be applied to that token [in wei / block]
     * @param _floor The new floor to be applied to that token
    */
    function updateTappedToken(address _token, uint256 _tap, uint256 _floor) external auth(UPDATE_TAPPED_TOKEN_ROLE) {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);
        require(_tapRateIsNotZero(_tap), ERROR_TAP_RATE_ZERO);
        require(_tapUpdateIsValid(_token, _tap), ERROR_INVALID_TAP_UPDATE);

        _updateTappedToken(_token, _tap, _floor);
    }

    /**
     * @notice Transfer about `@tokenAmount(_token, self.getMaximalWithdrawal(_token))` from `self.reserve()` to `self.beneficiary()`
     * @param _token The address of the token to be transfered from reserve to beneficiary
    */
    function withdraw(address _token) external auth(WITHDRAW_ROLE) {
        require(_tokenIsTapped(_token), ERROR_TOKEN_NOT_TAPPED);
        uint256 amount = _maximumWithdrawal(_token);
        require(amount > 0, ERROR_WITHDRAWAL_AMOUNT_ZERO);

        _withdraw(_token, amount);
    }

    /***** public functions *****/

    function getCurrentBatchId() public view isInitialized returns (uint256) {
        return _currentBatchId();
    }

    function getMaximumWithdrawal(address _token) public view isInitialized returns (uint256) {
        return _maximumWithdrawal(_token);
    }

    /***** internal functions *****/

    function _currentBatchId() internal view returns (uint256) {
        return (block.number.div(batchBlocks)).mul(batchBlocks);
    }

    function _maximumWithdrawal(address _token) internal view returns (uint256) {
        uint256 hold = controller.tokensToHold(_token);
        uint256 floor = floors[_token];
        uint256 minimum = hold.add(floor);
        uint256 balance = _token == ETH ? address(reserve).balance : ERC20(_token).staticBalanceOf(reserve);
        uint256 tapped = (_currentBatchId().sub(lastWithdrawals[_token])).mul(taps[_token]);

        if (minimum >= balance) {
            return 0;
        }

        if (balance >= tapped.add(minimum)) {
            return tapped;
        }

        return balance.sub(minimum);
    }

    function _beneficiaryIsValid(address _beneficiary) internal pure returns (bool) {
        return _beneficiary != address(0);
    }

    function _tokenIsETHOrContract(address _token) internal view returns (bool) {
        return isContract(_token) || _token == ETH;
    }

    function _tokenIsTapped(address _token) internal view returns (bool) {
        return taps[_token] != uint256(0);
    }

    function _tapRateIsNotZero(uint256 _tap) internal pure returns (bool) {
        return _tap != 0;
    }

    function _tapUpdateIsValid(address _token, uint256 _tap) internal view returns (bool) {
        uint256 tap = taps[_token];

        if (_tap <= tap) {
            return true;
        }

        if (getTimestamp() < lastTapUpdates[_token] + 30 days) {
            return false;
        }

        if (_tap.mul(PCT_BASE) <= tap.mul(PCT_BASE.add(maximumTapIncreasePct))) {
            return true;
        }

        return false;
    }

    function _updateController(IMarketMakerController _controller) internal {
        controller = _controller;

        emit UpdateController(address(_controller));
    }

    function _updateReserve(Vault _reserve) internal {
        reserve = _reserve;

        emit UpdateReserve(address(_reserve));
    }

    function _updateBeneficiary(address _beneficiary) internal {
        beneficiary = _beneficiary;

        emit UpdateBeneficiary(_beneficiary);
    }

    function _updateMaximumTapIncreasePct(uint256 _maximumTapIncreasePct) internal {
        maximumTapIncreasePct = _maximumTapIncreasePct;

        emit UpdateMaximumTapIncreasePct(_maximumTapIncreasePct);
    }

    function _addTappedToken(address _token, uint256 _tap, uint256 _floor) internal {
        /*
         * NOTE: if _token is tapped at the end of one batch it will
         * reach the next batch quickly [e.g. one block later] which
         * will allow a higher withdrawal than expected
         * NOTE: this is not a problem because this extra amount is static
         * [at most taps[_token] * batchBlocks] and does not increase in time
        */
        taps[_token] = _tap;
        floors[_token] = _floor;
        lastWithdrawals[_token] = _currentBatchId();
        lastTapUpdates[_token] = getTimestamp();

        emit AddTappedToken(_token, _tap, _floor);
    }

    function _removeTappedToken(address _token) internal {
        delete taps[_token];
        delete floors[_token];
        delete lastWithdrawals[_token];
        delete lastTapUpdates[_token];

        emit RemoveTappedToken(_token);
    }

    function _updateTappedToken(address _token, uint256 _tap, uint256 _floor) internal {
        taps[_token] = _tap;
        floors[_token] = _floor;
        lastTapUpdates[_token] = getTimestamp();

        emit UpdateTappedToken(_token, _tap, _floor);
    }

    function _withdraw(address _token, uint256 _amount) internal {
        lastWithdrawals[_token] = _currentBatchId();
        reserve.transfer(_token, beneficiary, _amount); // vault contract's transfer method already reverts on error

        emit Withdraw(_token, _amount);
    }
}
