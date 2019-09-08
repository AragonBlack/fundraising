pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";

import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@ablack/fundraising-shared-interfaces/contracts/IMarketMakerController.sol";


contract Presale is AragonApp {
    using SafeMath   for uint256;
    using SafeMath64 for uint64;
    using SafeERC20  for ERC20;

    bytes32 public constant OPEN_ROLE = keccak256("OPEN_ROLE");
    bytes32 public constant CONTRIBUTE_ROLE   = keccak256("CONTRIBUTE_ROLE");

    uint256 public constant PPM = 1000000; // 25% => 0.25 * 1e6 ; 50% => 0.50 * 1e6
    uint256 public constant CONNECTOR_WEIGHT_PPM = 100000; // 10%
    uint256 public constant COLLATERAL_TOKENS_CAP = 10;

    string private constant ERROR_INVALID_CONTROLLER       = "PRESALE_INVALID_CONTROLLER";
    string private constant ERROR_INVALID_STATE            = "PRESALE_INVALID_STATE";
    string private constant ERROR_INSUFFICIENT_ALLOWANCE   = "PRESALE_INSUFFICIENT_ALLOWANCE";
    string private constant ERROR_INSUFFICIENT_BALANCE     = "PRESALE_INSUFFICIENT_BALANCE";
    string private constant ERROR_INVALID_TOKEN_CONTROLLER = "PRESALE_INVALID_TOKEN_CONTROLLER";
    string private constant ERROR_NOTHING_TO_REFUND        = "PRESALE_NOTHING_TO_REFUND";
    string private constant ERROR_TOKEN_TRANSFER_REVERTED  = "PRESALE_TOKEN_TRANSFER_REVERTED";
    string private constant ERROR_INVALID_CONTRIBUTE_TOKEN = "PRESALE_INVALID_CONTRIBUTE_TOKEN";
    string private constant ERROR_INVALID_TIME_PERIOD      = "PRESALE_INVALID_TIME_PERIOD";
    string private constant ERROR_INVALID_PRESALE_GOAL     = "PRESALE_INVALID_PRESALE_GOAL";
    string private constant ERROR_INVALID_PERCENT_VALUE    = "PRESALE_INVALID_PERCENT_VALUE";
    string private constant ERROR_INVALID_RESERVE          = "PRESALE_INVALID_RESERVE";
    string private constant ERROR_INVALID_BENEFIC_ADDRESS  = "PRESALE_INVALID_BENEFIC_ADDRESS";
    string private constant ERROR_INVALID_COLLATERALS      = "PRESALE_INVALID_COLLATERALS";
    string private constant ERROR_EXCEEDS_FUNDING_GOAL     = "PRESALE_EXCEEDS_FUNDING_GOAL";

    enum PresaleState {
        Pending,     // presale is idle and pending to be started
        Funding,     // presale has started and contributors can purchase tokens
        Refunding,   // presale did not reach presaleGoal within presalePeriod and contributors may claim refunds
        GoalReached, // presale reached presaleGoal and the contiunous fundraising is ready to be initialized
        Closed       // after GoalReached, presale was closed and the continuous fundraising was initialized
    }

    IMarketMakerController public controller;
    ERC20                  public contributionToken;
    MiniMeToken            public token;
    TokenManager           public tokenManager;
    address                public reserve;
    address                public beneficiary;

    uint256 public presaleGoal;
    uint256 public totalRaised;
    uint256 public percentSupplyOffered; // represented in PPM
    uint256 public percentFundingForBeneficiary; // represented in PPM
    uint256 public tokenExchangeRate;
    uint64  public startDate;
    uint64  public presalePeriod;
    uint64  public vestingCliffPeriod;
    uint64  public vestingCompletePeriod;
    address[] public collaterals;

    mapping(address => mapping(uint256 => uint256)) public purchases; // buyer => (vestedPurchaseId => tokensSpent)

    bool   private presaleClosed;
    uint64 private vestingCliffDate;
    uint64 private vestingCompleteDate;

    event PresaleClosed();
    event Contribute(address indexed buyer, uint256 tokensSpent, uint256 tokensPurchased, uint256 vestedPurchaseId);
    event Refund(address indexed buyer, uint256 tokensRefunded, uint256 tokensBurned, uint256 vestedPurchaseId);

    /*
     * Initialization
     */

    /**
    * @notice Initialize Presale app with `_contributionToken` to be used for purchasing `_projectToken`, controlled by `_projectTokenManager`. Project tokens are provided in vested form using `_vestingCliffPeriod` and `_vestingCompletePeriod`. The Presale accepts tokens until `_presaleGoal` is reached. `percentSupplyOffered` is used to calculate the contribution token to project token exchange rate. The presale allows project token purchases for `_presalePeriod` after the sale is started. If the funding goal is reached, part of the raised funds are sent to `_reserve`, associated with a Fundraising app. The raised funds that are not sent to the fundraising pool are sent to `_beneficiary` according to the ratio specified in `_percentFundingForBenefiriary`. Optionally, if a non-zero `_startDate` is provided, the sale will start at the specified date, without the need of the owner of the START_ROLE calling `start()`.
    * @param _contributionToken ERC20 Token accepted for purchasing project tokens.
    * @param _token MiniMeToken project tokens being offered for sale in vested form.
    * @param _tokenManager TokenManager Token manager in control of the offered project tokens.
    * @param _vestingCliffPeriod uint64 Cliff period used for vested project tokens.
    * @param _vestingCompletePeriod uint64 Complete period used for vested project tokens.
    * @param _presaleGoal uint256 Target contribution token funding goal.
    * @param _percentSupplyOffered uin256 Percent of the total supply of project tokens that will be offered in this sale and in further fundraising stages.
    * @param _presalePeriod uint64 The period within which this sale accepts project token purchases.
    * @param _reserve Pool The fundraising pool associated with the Fundraising app where part of the raised contribution tokens will be sent to, if this sale is succesful.
    * @param _beneficiary address The address to which part of the raised contribution tokens will be sent to, if this sale is successful.
    * @param _percentFundingForBeneficiary uint256 The percentage of the raised contribution tokens that will be sent to the beneficiary address, instead of the fundraising pool, when this sale is closed.
    * @param _startDate uint64 Optional start date of the sale, ignored if 0.
    */
    function initialize(
        IMarketMakerController _controller,
        ERC20                  _contributionToken,
        MiniMeToken            _token,
        TokenManager           _tokenManager,
        uint64  _vestingCliffPeriod,
        uint64  _vestingCompletePeriod,
        uint256 _presaleGoal,
        uint256 _percentSupplyOffered,
        uint64  _presalePeriod,
        address _reserve,
        address _beneficiary,
        uint256 _percentFundingForBeneficiary,
        uint64  _startDate,
        address[] _collaterals
    )
        external
        onlyInit
    {
        require(isContract(_controller), ERROR_INVALID_CONTROLLER);
        require(isContract(_contributionToken), ERROR_INVALID_CONTRIBUTE_TOKEN);
        require(isContract(_reserve), ERROR_INVALID_RESERVE);
        require(_presalePeriod > 0, ERROR_INVALID_TIME_PERIOD);
        require(_vestingCliffPeriod > _presalePeriod, ERROR_INVALID_TIME_PERIOD);
        require(_vestingCompletePeriod > _vestingCliffPeriod, ERROR_INVALID_TIME_PERIOD);
        require(_presaleGoal > 0, ERROR_INVALID_PRESALE_GOAL);
        require(_percentSupplyOffered > 0, ERROR_INVALID_PERCENT_VALUE);
        require(_percentSupplyOffered < PPM, ERROR_INVALID_PERCENT_VALUE);
        require(_beneficiary != 0x0, ERROR_INVALID_BENEFIC_ADDRESS);
        require(_percentFundingForBeneficiary > 0, ERROR_INVALID_PERCENT_VALUE);
        require(_percentFundingForBeneficiary < PPM, ERROR_INVALID_PERCENT_VALUE);
        require(_collaterals.length > 0 && _collaterals.length < COLLATERAL_TOKENS_CAP, ERROR_INVALID_COLLATERALS);

        initialized();

        controller = _controller;
        contributionToken = _contributionToken;
        _setCollaterals(_collaterals);
        _setProjectToken(_token, _tokenManager);

        reserve = _reserve;

        vestingCliffPeriod = _vestingCliffPeriod;
        vestingCompletePeriod = _vestingCompletePeriod;
        presalePeriod = _presalePeriod;

        beneficiary = _beneficiary;
        percentFundingForBeneficiary = _percentFundingForBeneficiary;

        presaleGoal = _presaleGoal;
        percentSupplyOffered = _percentSupplyOffered;

        if (_startDate != 0) {
            _setStartDate(_startDate);
        }

        _calculateExchangeRate();
    }

    /*
     * Public
     */

    /**
    * @notice Starts the presale, changing its state to Funding. After the presale is started contributors will be able to purchase project tokens.
    */
    function open() external auth(OPEN_ROLE) {
        require(currentPresaleState() == PresaleState.Pending, ERROR_INVALID_STATE);
        _setStartDate(getTimestamp64());
    }

    /**
    * @notice Buys tokens using the provided `_value` contribution tokens. To calculate how many project tokens will be sold for the provided contribution tokens amount, use contributionToTokens(). Each purchase generates a numeric vestedPurchaseId (0, 1, 2, etc) for the caller, which can be obtained in the TokensPurchased event emitted, and is required for later refunds. Note: If `_tokensToSpend` + `totalRaised` is larger than `presaleGoal`, only part of it will be used so that the funding goal is never exceeded.
    * @param _value The amount of contribution tokens to spend to obtain project tokens.
    */
    function contribute(address _contributor, uint256 _value) external auth(CONTRIBUTE_ROLE) {
        require(currentPresaleState() == PresaleState.Funding, ERROR_INVALID_STATE);

        uint256 value = totalRaised.add(_value) > presaleGoal ? presaleGoal.sub(totalRaised) : _value;

        require(contributionToken.balanceOf(_contributor) >= value, ERROR_INSUFFICIENT_BALANCE);
        require(contributionToken.allowance(_contributor, address(this)) >= value, ERROR_INSUFFICIENT_ALLOWANCE);
        // (buyer) ~~~> contribution tokens ~~~> (presale)
        require(contributionToken.safeTransferFrom(_contributor, address(this), value), ERROR_TOKEN_TRANSFER_REVERTED);

        // (mint ✨) ~~~> project tokens ~~~> (buyer)
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

        // keep track of contribution tokens spent in this purchase for later refunding.
        purchases[_contributor][vestedPurchaseId] = value;

        emit Contribute(_contributor, value, tokensToSell, vestedPurchaseId);
    }

    /**
     * @notice Refunds a purchase made by `_buyer`, with id `_vestedPurchaseId`. Each purchase has a purchase id, and needs to be refunded separately.
     * @param _buyer address The buyer address to refund.
     * @param _vestedPurchaseId uint256 The purchase id to refund.
    */
    function refund(address _buyer, uint256 _vestedPurchaseId) external {
        require(currentPresaleState() == PresaleState.Refunding, ERROR_INVALID_STATE);

        // recall how much contribution tokens are to refund for this purchase
        uint256 tokensToRefund = purchases[_buyer][_vestedPurchaseId];
        require(tokensToRefund > 0, ERROR_NOTHING_TO_REFUND);
        purchases[_buyer][_vestedPurchaseId] = 0;

        // (presale) ~~~> contribution tokens ~~~> (buyer)
        require(contributionToken.safeTransfer(_buyer, tokensToRefund), ERROR_TOKEN_TRANSFER_REVERTED);

        // (buyer) ~~~> project tokens ~~~> (token manager)
        /**
         *NOTE: this assumes that the buyer didn't transfer any of the vested tokens
         * this assumption can be made considering the imposed restriction of presalePeriod < vestingCliffPeriod < vestingCompletePeriod
        */
        (uint256 tokensSold,,,,) = tokenManager.getVesting(_buyer, _vestedPurchaseId);
        tokenManager.revokeVesting(_buyer, _vestedPurchaseId);

        // (token manager) ~~~> project tokens ~~~> (burn 💥)
        tokenManager.burn(address(tokenManager), tokensSold);

        emit Refund(_buyer, tokensToRefund, tokensSold, _vestedPurchaseId);
    }

    /**
    * @notice Closes a sale that has reached the funding goal, sending raised funds to the fundraising pool and the beneficiary address, and initializes the Fundraising app by adding the raised funds as collateral tokens.
    */
    function close() external {
        require(currentPresaleState() == PresaleState.GoalReached, ERROR_INVALID_STATE);

        // (presale) ~~~> contribution tokens ~~~> (beneficiary)
        uint256 tokensForBeneficiary = totalRaised.mul(percentFundingForBeneficiary).div(PPM);
        require(contributionToken.safeTransfer(beneficiary, tokensForBeneficiary), ERROR_TOKEN_TRANSFER_REVERTED);

        // (presale) ~~~> contribution tokens ~~~> (reserve)
        uint256 tokensForReserve = contributionToken.balanceOf(address(this));
        require(contributionToken.safeTransfer(reserve, tokensForReserve), ERROR_TOKEN_TRANSFER_REVERTED);

        presaleClosed = true;

        for (uint256 i = 0; i < collaterals.length; i++) {
            controller.resetTokenTap(collaterals[i]);
        }
        controller.openCampaign();

        emit PresaleClosed();
    }

    /*
     * Getters
     */

    /**
     * @notice Calculates the number of project tokens that would be obtained for `_value` contribution tokens.
     * @param _value uint256 The amount of contribution tokens to be converted into project tokens.
    */
    function contributionToTokens(uint256 _value) public view returns (uint256) {
        return _value.mul(tokenExchangeRate);
    }

    /**
     * @notice Calculates the current state of the sale.
    */
    function currentPresaleState() public view returns (PresaleState) {
        if (startDate == 0 || startDate > getTimestamp64()) {
            return PresaleState.Pending;
        }

        if (totalRaised >= presaleGoal) {
            if (presaleClosed) {
                return PresaleState.Closed;
            } else {
                return PresaleState.GoalReached;
            }
        }

        if (_timeSinceFundingStarted() < presalePeriod) {
            return PresaleState.Funding;
        } else {
            return PresaleState.Refunding;
        }
    }

    /*
     * Internal
     */

    function _setStartDate(uint64 _date) internal {
        require(_date >= getTimestamp64(), ERROR_INVALID_TIME_PERIOD);
        startDate = _date;
        _setVestingDatesWhenStartDateIsKnown();
    }

    function _setVestingDatesWhenStartDateIsKnown() internal {
        vestingCliffDate = startDate.add(vestingCliffPeriod);
        vestingCompleteDate = startDate.add(vestingCompletePeriod);
    }

    function _timeSinceFundingStarted() internal view returns (uint64) {
        if (startDate == 0) {
            return 0;
        } else {
            return getTimestamp64().sub(startDate);
        }
    }

    function _calculateExchangeRate() internal {
        tokenExchangeRate = presaleGoal.mul(PPM).mul(percentSupplyOffered).div(CONNECTOR_WEIGHT_PPM).div(PPM);
    }

    function _setCollaterals(address[] _collaterals) internal {
        for (uint256 i = 0; i < _collaterals.length; i++) {
            require(isContract(_collaterals[i]), ERROR_INVALID_COLLATERALS);
            collaterals.push(_collaterals[i]);
        }

    }

    function _setProjectToken(MiniMeToken _projectToken, TokenManager _projectTokenManager) internal {
        require(isContract(_projectTokenManager), ERROR_INVALID_TOKEN_CONTROLLER);
        require(_projectTokenManager.token() == address(_projectToken), ERROR_INVALID_TOKEN_CONTROLLER);
        token = _projectToken;
        tokenManager = _projectTokenManager;
    }
}
