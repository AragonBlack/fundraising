pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/EtherTokenConstant.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@ablack/fundraising-shared-interfaces/contracts/IAragonFundraisingController.sol";


contract Presale is EtherTokenConstant, IsContract, AragonApp {
    using SafeERC20  for ERC20;
    using SafeMath   for uint256;
    using SafeMath64 for uint64;

    /**
    Hardcoded constants to save gas
    bytes32 public constant OPEN_ROLE       = keccak256("OPEN_ROLE");
    bytes32 public constant CONTRIBUTE_ROLE = keccak256("CONTRIBUTE_ROLE");
    */
    bytes32 public constant OPEN_ROLE       = 0xefa06053e2ca99a43c97c4a4f3d8a394ee3323a8ff237e625fba09fe30ceb0a4;
    bytes32 public constant CONTRIBUTE_ROLE = 0x9ccaca4edf2127f20c425fdd86af1ba178b9e5bee280cd70d88ac5f6874c4f07;

    uint256 public constant PPM                   = 1000000; // 0% = 0; 1% = 10 ** 4; 100% = 10 ** 6
    uint256 public constant COLLATERAL_TOKENS_CAP = 10;

    string private constant ERROR_CONTRACT_IS_EOA          = "PRESALE_CONTRACT_IS_EOA";
    string private constant ERROR_INVALID_BENEFICIARY      = "PRESALE_INVALID_BENEFICIARY";
    string private constant ERROR_INVALID_CONTRIBUTE_TOKEN = "PRESALE_INVALID_CONTRIBUTE_TOKEN";
    string private constant ERROR_INVALID_RESERVE_RATIO    = "PRESALE_INVALID_RESERVE_RATIO";
    string private constant ERROR_INVALID_PRESALE_GOAL     = "PRESALE_INVALID_PRESALE_GOAL";
    string private constant ERROR_INVALID_TIME_PERIOD      = "PRESALE_INVALID_TIME_PERIOD";
    string private constant ERROR_INVALID_PCT              = "PRESALE_INVALID_PCT";
    string private constant ERROR_INVALID_COLLATERALS      = "PRESALE_INVALID_COLLATERALS";
    string private constant ERROR_INVALID_STATE            = "PRESALE_INVALID_STATE";
    string private constant ERROR_INSUFFICIENT_BALANCE     = "PRESALE_INSUFFICIENT_BALANCE";
    string private constant ERROR_INSUFFICIENT_ALLOWANCE   = "PRESALE_INSUFFICIENT_ALLOWANCE";
    string private constant ERROR_NOTHING_TO_REFUND        = "PRESALE_NOTHING_TO_REFUND";
    string private constant ERROR_TOKEN_TRANSFER_REVERTED  = "PRESALE_TOKEN_TRANSFER_REVERTED";

    enum PresaleState {
        Pending,     // presale is idle and pending to be started
        Funding,     // presale has started and contributors can purchase tokens
        Refunding,   // presale has not reach presaleGoal within presalePeriod and contributors can claim refunds
        GoalReached, // presale has reached presaleGoal within presalePeriod and trading is ready to be open
        Closed       // presale has reached presaleGoal within presalePeriod, has been closed and trading has been open
    }

    IAragonFundraisingController                    public controller;
    TokenManager                                    public tokenManager;
    ERC20                                           public token;
    address                                         public reserve;
    address                                         public beneficiary;
    ERC20                                           public contributionToken;
    uint256                                         public reserveRatio;

    uint256                                         public presaleGoal;
    uint64                                          public presalePeriod;
    uint64                                          public vestingCliffPeriod;
    uint64                                          public vestingCompletePeriod;
    uint256                                         public percentSupplyOffered;
    uint256                                         public percentFundingForBeneficiary;
    uint64                                          public startDate;
    address[]                                       public collaterals;

    bool                                            public isClosed;
    uint64                                          public vestingCliffDate;
    uint64                                          public vestingCompleteDate;
    uint256                                         public tokenExchangeRate;
    uint256                                         public totalRaised;
    mapping(address => mapping(uint256 => uint256)) public purchases; // contributor => (vestedPurchaseId => tokensSpent)

    event SetStartDate(uint64 date);
    event Close       ();
    event Contribute  (address indexed contributor, uint256 value, uint256 amount, uint256 vestedPurchaseId);
    event Refund      (address indexed contributor, uint256 value, uint256 amount, uint256 vestedPurchaseId);


    /***** external function *****/

    /**
     * @notice Initialize presale
     * @param _controller                   The address of the controller contract
     * @param _tokenManager                 The address of the [bonded token] token manager contract
     * @param _reserve                      The address of the reserve [pool] contract
     * @param _beneficiary                  The address of the beneficiary [to whom a percentage of the raised funds is be to be sent]
     * @param _contributionToken            The address of the token to be used to contribute
     * @param _reserveRatio                 The reserve ratio to be used in the computation of that presale exchange rate [in PPM]
     * @param _presaleGoal                  The goal to be reached by the end of that presale [in contribution token wei]
     * @param _presalePeriod                The period within which to accept contribution for that presale
     * @param _vestingCliffPeriod           The period during which purchased [bonded] tokens are to be cliffed
     * @param _vestingCompletePeriod        The complete period during which purchased [bonded] tokens are to be vested
     * @param _percentSupplyOffered         The percentage of the total supply of [bonded] tokens to be offered during that presale [in PPM]
     * @param _percentFundingForBeneficiary The percentage of the raised contribution tokens to be sent to the beneficiary [instead of the fundraising reserve] when that presale is closed [in PPM]
     * @param _startDate                    The date upon which that presale is to be open [ignored if 0]
     * @param _collaterals                  The trading collaterals whose tap timestamps are to be reset when that presale is closed
    */
    function initialize(
        IAragonFundraisingController _controller,
        TokenManager                 _tokenManager,
        address                      _reserve,
        address                      _beneficiary,
        ERC20                        _contributionToken,
        uint256                      _reserveRatio,
        uint256                      _presaleGoal,
        uint64                       _presalePeriod,
        uint64                       _vestingCliffPeriod,
        uint64                       _vestingCompletePeriod,
        uint256                      _percentSupplyOffered,
        uint256                      _percentFundingForBeneficiary,
        uint64                       _startDate,
        address[]                    _collaterals
    )
        external
        onlyInit
    {
        require(isContract(_controller),                                                    ERROR_CONTRACT_IS_EOA);
        require(isContract(_tokenManager),                                                  ERROR_CONTRACT_IS_EOA);
        require(isContract(_reserve),                                                       ERROR_CONTRACT_IS_EOA);
        require(_beneficiary != address(0),                                                 ERROR_INVALID_BENEFICIARY);
        require(isContract(_contributionToken) || _contributionToken == ETH,                ERROR_INVALID_CONTRIBUTE_TOKEN);
        require(_reserveRatio <= PPM,                                                       ERROR_INVALID_RESERVE_RATIO);
        require(_presaleGoal > 0,                                                           ERROR_INVALID_PRESALE_GOAL);
        require(_presalePeriod > 0,                                                         ERROR_INVALID_TIME_PERIOD);
        require(_vestingCliffPeriod > _presalePeriod,                                       ERROR_INVALID_TIME_PERIOD);
        require(_vestingCompletePeriod > _vestingCliffPeriod,                               ERROR_INVALID_TIME_PERIOD);
        require(_percentSupplyOffered >= 0 && _percentSupplyOffered <= PPM,                 ERROR_INVALID_PCT);
        require(_percentFundingForBeneficiary >= 0 && _percentFundingForBeneficiary <= PPM, ERROR_INVALID_PCT);
        require(_collaterals.length > 0 && _collaterals.length < COLLATERAL_TOKENS_CAP,     ERROR_INVALID_COLLATERALS);

        initialized();

        controller = _controller;
        tokenManager = _tokenManager;
        token = ERC20(_tokenManager.token());
        reserve = _reserve;
        beneficiary = _beneficiary;
        contributionToken = _contributionToken;
        reserveRatio = _reserveRatio;
        presaleGoal = _presaleGoal;
        presalePeriod = _presalePeriod;
        vestingCliffPeriod = _vestingCliffPeriod;
        vestingCompletePeriod = _vestingCompletePeriod;
        percentSupplyOffered = _percentSupplyOffered;
        percentFundingForBeneficiary = _percentFundingForBeneficiary;

        if (_startDate != 0) {
            _setStartDate(_startDate);
        }
        _setExchangeRate();
        _setCollaterals(_collaterals);
    }

    /**
     * @notice Open presale [enabling users to contribute]
    */
    function open() external auth(OPEN_ROLE) {
        require(currentPresaleState() == PresaleState.Pending, ERROR_INVALID_STATE);

        _open();
    }

    /**
     * @notice Contribute to the presale up to `@tokenAmount(self.contributionToken(): address, _value)`
     * @param _contributor The address of the contributor
     * @param _value       The amount of contribution token to be spent
    */
    function contribute(address _contributor, uint256 _value) external payable auth(CONTRIBUTE_ROLE) {
        require(currentPresaleState() == PresaleState.Funding, ERROR_INVALID_STATE);
        uint256 value = totalRaised.add(_value) > presaleGoal ? presaleGoal.sub(totalRaised) : _value;
        // TODO: handle ETH case
        // TODO: now that the function is payable, check if no excess ETH value is sent, otherwise revert
        require(contributionToken.balanceOf(_contributor) >= value,                ERROR_INSUFFICIENT_BALANCE);
        require(contributionToken.allowance(_contributor, address(this)) >= value, ERROR_INSUFFICIENT_ALLOWANCE);

        // (contributor) ~~~> contribution tokens ~~~> (presale)
        // TODO: handle ETH case
        require(contributionToken.safeTransferFrom(_contributor, address(this), value), ERROR_TOKEN_TRANSFER_REVERTED);
        // (mint ✨) ~~~> project tokens ~~~> (contributor)
        uint256 tokensToSell = contributionToTokens(value);
        tokenManager.issue(tokensToSell);
        uint256 vestedPurchaseId = tokenManager.assignVested(
            _contributor,
            tokensToSell,
            startDate,
            vestingCliffDate,
            vestingCompleteDate,
            true /* revokable */
        );
        totalRaised = totalRaised.add(value);
        // register contribution tokens spent in this purchase for a possible upcoming refund
        purchases[_contributor][vestedPurchaseId] = value;

        emit Contribute(_contributor, value, tokensToSell, vestedPurchaseId);
    }

    /**
     * @notice Refund `_contributor`'s presale contribution #`_vestedPurchaseId`
     * @param _contributor      The address of the contributor whose presale contribution is to be refunded
     * @param _vestedPurchaseId The id of the contribution to be refunded
    */
    function refund(address _contributor, uint256 _vestedPurchaseId) external isInitialized {
        require(currentPresaleState() == PresaleState.Refunding, ERROR_INVALID_STATE);

        // recall how much contribution tokens are to be refund for this purchase
        uint256 tokensToRefund = purchases[_contributor][_vestedPurchaseId];
        require(tokensToRefund > 0, ERROR_NOTHING_TO_REFUND);
        purchases[_contributor][_vestedPurchaseId] = 0;

        // (presale) ~~~> contribution tokens ~~~> (contributor)
        // TODO: Handle ETH case
        require(contributionToken.safeTransfer(_contributor, tokensToRefund), ERROR_TOKEN_TRANSFER_REVERTED);

        /**
         * NOTE
         * the following lines assume that _contributor has not transfered any of its vested tokens
         * for now TokenManager does not handle switching the transferrable status of its underlying token
         * there is thus no way to enforce non-transferrability during the presale phase only
         * this will be updated in a later version
        */
        // (contributor) ~~~> project tokens ~~~> (token manager)
        (uint256 tokensSold,,,,) = tokenManager.getVesting(_contributor, _vestedPurchaseId);
        tokenManager.revokeVesting(_contributor, _vestedPurchaseId);
        // (token manager) ~~~> project tokens ~~~> (burn 💥)
        tokenManager.burn(address(tokenManager), tokensSold);

        emit Refund(_contributor, tokensToRefund, tokensSold, _vestedPurchaseId);
    }

    /**
     * @notice Close presale and open trading
    */
    function close() external isInitialized {
        require(currentPresaleState() == PresaleState.GoalReached, ERROR_INVALID_STATE);

        // (presale) ~~~> contribution tokens ~~~> (beneficiary)
        uint256 tokensForBeneficiary = totalRaised.mul(percentFundingForBeneficiary).div(PPM);
        require(contributionToken.safeTransfer(beneficiary, tokensForBeneficiary), ERROR_TOKEN_TRANSFER_REVERTED);
        // (presale) ~~~> contribution tokens ~~~> (reserve)
        uint256 tokensForReserve = contributionToken.balanceOf(address(this));
        require(contributionToken.safeTransfer(reserve, tokensForReserve), ERROR_TOKEN_TRANSFER_REVERTED);

        isClosed = true;
        _resetCollateralsTaps();
        controller.openTrading();

        emit Close();
    }

    /***** public view functions *****/

    /**
     * @notice Computes the amount of [bonded] tokens that would be purchased for `@tokenAmount(self.contributionToken(): address, _value)`
     * @param _value The amount of contribution tokens to be used in that computation
    */
    function contributionToTokens(uint256 _value) public view isInitialized returns (uint256) {
        return _value.mul(tokenExchangeRate);
    }

    /**
     * @notice Returns the current state of that presale
    */
    function currentPresaleState() public view isInitialized returns (PresaleState) {
        if (startDate == 0 || startDate > getTimestamp64()) {
            return PresaleState.Pending;
        }

        if (totalRaised >= presaleGoal) {
            if (isClosed) {
                return PresaleState.Closed;
            } else {
                return PresaleState.GoalReached;
            }
        }

        if (timeSinceOpen() < presalePeriod) {
            return PresaleState.Funding;
        } else {
            return PresaleState.Refunding;
        }
    }

    function timeSinceOpen() public view isInitialized returns (uint64) {
        if (startDate == 0) {
            return 0;
        } else {
            return getTimestamp64().sub(startDate);
        }
    }

    /***** internal functions *****/

    function _open() internal {
        _setStartDate(getTimestamp64());
    }

    function _setStartDate(uint64 _date) internal {
        require(_date >= getTimestamp64(), ERROR_INVALID_TIME_PERIOD);
        startDate = _date;
        _setVestingDatesWhenStartDateIsKnown();

        emit SetStartDate(_date);
    }

    function _setExchangeRate() internal {
        tokenExchangeRate = presaleGoal.mul(PPM).mul(percentSupplyOffered).div(reserveRatio).div(PPM);
    }

    function _setCollaterals(address[] _collaterals) internal {
        for (uint256 i = 0; i < _collaterals.length; i++) {
            require(isContract(_collaterals[i]) || _collaterals[i] == ETH, ERROR_INVALID_COLLATERALS);
            collaterals.push(_collaterals[i]);
        }
    }

    function _setVestingDatesWhenStartDateIsKnown() internal {
        vestingCliffDate = startDate.add(vestingCliffPeriod);
        vestingCompleteDate = startDate.add(vestingCompletePeriod);
    }

    function _resetCollateralsTaps() internal {
        for (uint256 i = 0; i < collaterals.length; i++) {
            controller.resetTokenTap(collaterals[i]);
        }
    }
}
