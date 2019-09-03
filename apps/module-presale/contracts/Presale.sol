pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";

import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";

import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";


contract Presale is AragonApp {
    using SafeMath for uint256;
    using SafeMath64 for uint64;

    /*
     * Events
     */

    event SaleClosed();
    event TokensPurchased(address indexed buyer, uint256 tokensSpent, uint256 tokensPurchased, uint256 vestedPurchaseId);
    event TokensRefunded(address indexed buyer, uint256 tokensRefunded, uint256 tokensBurned, uint256 vestedPurchaseId);

    /*
     * Errors
     */

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
    string private constant ERROR_EXCEEDS_FUNDING_GOAL     = "PRESALE_EXCEEDS_FUNDING_GOAL";

    /*
     * Roles
     */

    bytes32 public constant START_ROLE = keccak256("START_ROLE");
    bytes32 public constant BUY_ROLE   = keccak256("BUY_ROLE");

    /*
     * Constants
     */

    // Percentages are represented in the PPM range (Parts per Million) [0, 1000000]
    // 25% => 0.25 * 1e6
    // 50% => 0.50 * 1e6
    uint256 public constant PPM = 1000000;

    // Used to calculate tokenExchangeRate.
    uint256 public constant CONNECTOR_WEIGHT_PPM = 100000; // 10%

    /*
     * Properties
     */

    // Token that will be accepted as payment for
    // purchasing project tokens.
    ERC20 public contributionToken;

    // Token that is being offered for purchase in the sale.
    MiniMeToken public projectToken;
    TokenManager public projectTokenManager;

    // Funding goal and total tokens raised in the sale.
    // Note: no further purchases will be allowed after presaleGoal is reached.
    uint256 public presaleGoal;
    uint256 public totalRaised;

    // Percentage of the total supply of project tokens that will be offered to contributors,
    // in this pre-sale and in further fundraising stages.
    uint256 public percentSupplyOffered; // Represented in PPM, see below

    // Once the sale is closed, totalRaised is split according to
    // percentFundingForBeneficiary, between beneficiary and reserve.
    address public reserve;
    address public beneficiary;
    uint256 public percentFundingForBeneficiary; // Represented in PPM, see below

    // Date when the sale is started and its state is Funding.
    uint64 public startDate;

    // Vesting parameters.
    // Note: startDate also represents the starting date for all vested project tokens.
    uint64 public vestingCliffPeriod;
    uint64 public vestingCompletePeriod;

    // Period after startDate, in which the sale is Funding and accepts contributions.
    // If the presaleGoal is not reached within it, the sale cannot be Closed
    // and the state switches to Refunding, allowing refunds.
    uint64 public presalePeriod;

    // Number of project tokens that will be sold for each contribution token.
    // Calculated after initialization from the values CONNECTOR_WEIGHT_PPM and percentSupplyOffered.
    uint256 public tokenExchangeRate;

    // Keeps track of how much contribution tokens are spent, per purchase, per buyer.
    // This is used when refunding purchases.
    mapping(address => mapping(uint256 => uint256)) public purchases;
    /*      |                  |          |
     *      |                  |          tokensSpent
     *      |                  vestedPurchaseId
     *      buyer
     */

    bool private saleClosed;
    uint64 private vestingCliffDate;
    uint64 private vestingCompleteDate;

    // No state variable keeps track of the current state, but is rather
    // calculated from other variables. See: currentSaleState().
    enum SaleState {
        Pending,     // Sale is idle and pending to be started.
        Funding,     // Sale has started and contributors can purchase tokens.
        Refunding,   // Sale did not reach presaleGoal within presalePeriod and contributors may claim refunds.
        GoalReached, // Sale reached presaleGoal and the Fundraising app is ready to be initialized.
        Closed       // After GoalReached, sale was closed and the Fundraising app was initialized.
    }

    /*
     * Initialization
     */

    /**
    * @notice Initialize Presale app with `_contributionToken` to be used for purchasing `_projectToken`, controlled by `_projectTokenManager`. Project tokens are provided in vested form using `_vestingCliffPeriod` and `_vestingCompletePeriod`. The Presale accepts tokens until `_presaleGoal` is reached. `percentSupplyOffered` is used to calculate the contribution token to project token exchange rate. The presale allows project token purchases for `_presalePeriod` after the sale is started. If the funding goal is reached, part of the raised funds are sent to `_reserve`, associated with a Fundraising app. The raised funds that are not sent to the fundraising pool are sent to `_beneficiary` according to the ratio specified in `_percentFundingForBenefiriary`. Optionally, if a non-zero `_startDate` is provided, the sale will start at the specified date, without the need of the owner of the START_ROLE calling `start()`.
    * @param _contributionToken ERC20 Token accepted for purchasing project tokens.
    * @param _projectToken MiniMeToken project tokens being offered for sale in vested form.
    * @param _projectTokenManager TokenManager Token manager in control of the offered project tokens.
    * @param _vestingCliffPeriod uint64 Cliff period used for vested project tokens.
    * @param _vestingCompletePeriod uint64 Complete period used for vested project tokens.
    * @param _presaleGoal uint256 Target contribution token funding goal.
    * @param _percentSupplyOffered uin256 Percent of the total supply of project tokens that will be offered in this sale and in further fundraising stages.
    * @param _presalePeriod uint64 The period within which this sale accepts project token purchases.
    * @param _reserve Pool The fundraising pool associated with the Fundraising app where part of the raised contribution tokens will be sent to, if this sale is succesful.
    * @param _beneficiary address The address to which part of the raised contribution tokens will be sent to, if this sale is successful.
    * @param _percentFundingForBenefiriary uint256 The percentage of the raised contribution tokens that will be sent to the beneficiary address, instead of the fundraising pool, when this sale is closed.
    * @param _startDate uint64 Optional start date of the sale, ignored if 0.
    */
    function initialize(
        ERC20 _contributionToken,
        MiniMeToken _projectToken,
        TokenManager _projectTokenManager,
        uint64 _vestingCliffPeriod,
        uint64 _vestingCompletePeriod,
        uint256 _presaleGoal,
        uint256 _percentSupplyOffered,
        uint64 _presalePeriod,
        address _reserve,
        address _beneficiary,
        uint256 _percentFundingForBenefiriary,
        uint64 _startDate
    )
        external
        onlyInit
    {
        require(isContract(_contributionToken), ERROR_INVALID_CONTRIBUTE_TOKEN);
        require(isContract(_reserve), ERROR_INVALID_RESERVE);
        require(_presalePeriod > 0, ERROR_INVALID_TIME_PERIOD);
        require(_vestingCliffPeriod > _presalePeriod, ERROR_INVALID_TIME_PERIOD);
        require(_vestingCompletePeriod > _vestingCliffPeriod, ERROR_INVALID_TIME_PERIOD);
        require(_presaleGoal > 0, ERROR_INVALID_PRESALE_GOAL);
        require(_percentSupplyOffered > 0, ERROR_INVALID_PERCENT_VALUE);
        require(_percentSupplyOffered < PPM, ERROR_INVALID_PERCENT_VALUE);
        require(_beneficiary != 0x0, ERROR_INVALID_BENEFIC_ADDRESS);
        require(_percentFundingForBenefiriary > 0, ERROR_INVALID_PERCENT_VALUE);
        require(_percentFundingForBenefiriary < PPM, ERROR_INVALID_PERCENT_VALUE);

        initialized();

        contributionToken = _contributionToken;
        _setProjectToken(_projectToken, _projectTokenManager);

        reserve = _reserve;

        vestingCliffPeriod = _vestingCliffPeriod;
        vestingCompletePeriod = _vestingCompletePeriod;
        presalePeriod = _presalePeriod;

        beneficiary = _beneficiary;
        percentFundingForBeneficiary = _percentFundingForBenefiriary;

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
    * @notice Starts the sale, changing its state to Funding. After the sale is started contributors will be able to purchase project tokens.
    */
    function start() public auth(START_ROLE) {
        require(currentSaleState() == SaleState.Pending, ERROR_INVALID_STATE);
        _setStartDate(getTimestamp64());
    }

    /**
    * @notice Buys project tokens using the provided `_tokensToSpend` contribution tokens. To calculate how many project tokens will be sold for the provided contribution tokens amount, use contributionToProjectTokens(). Each purchase generates a numeric vestedPurchaseId (0, 1, 2, etc) for the caller, which can be obtained in the TokensPurchased event emitted, and is required for later refunds. Note: If `_tokensToSpend` + `totalRaised` is larger than `presaleGoal`, only part of it will be used so that the funding goal is never exceeded.
    * @param _tokensToSpend The amount of contribution tokens to spend to obtain project tokens.
    */
    function buy(uint256 _tokensToSpend) public auth(BUY_ROLE) {
        require(currentSaleState() == SaleState.Funding, ERROR_INVALID_STATE);

        uint256 tokensToUse = _tokensToSpend;
        if (totalRaised.add(tokensToUse) > presaleGoal) {
            tokensToUse = presaleGoal.sub(totalRaised);
        }

        require(contributionToken.balanceOf(msg.sender) >= tokensToUse, ERROR_INSUFFICIENT_BALANCE);
        require(contributionToken.allowance(msg.sender, address(this)) >= tokensToUse, ERROR_INSUFFICIENT_ALLOWANCE);

        // (buyer) ~~~> contribution tokens ~~~> (presale)
        require(contributionToken.transferFrom(msg.sender, address(this), tokensToUse), ERROR_TOKEN_TRANSFER_REVERTED);

        // (mint ✨) ~~~> project tokens ~~~> (buyer)
        uint256 tokensToSell = contributionToProjectTokens(tokensToUse);
        projectTokenManager.issue(tokensToSell);
        uint256 vestedPurchaseId = projectTokenManager.assignVested(
            msg.sender,
            tokensToSell,
            startDate,
            vestingCliffDate,
            vestingCompleteDate,
            true /* revokable */
        );
        totalRaised = totalRaised.add(tokensToUse);

        // Keep track of contribution tokens spent in this purchase for later refunding.
        purchases[msg.sender][vestedPurchaseId] = tokensToUse;

        emit TokensPurchased(msg.sender, tokensToUse, tokensToSell, vestedPurchaseId);
    }

    /**
    * @notice Refunds a purchase made by `_buyer`, with id `_vestedPurchaseId`. Each purchase has a purchase id, and needs to be refunded separately.
    * @param _buyer address The buyer address to refund.
    * @param _vestedPurchaseId uint256 The purchase id to refund.
    */
    function refund(address _buyer, uint256 _vestedPurchaseId) public {
        require(currentSaleState() == SaleState.Refunding, ERROR_INVALID_STATE);

        // Recall how much contribution tokens to refund for this purchase.
        uint256 tokensToRefund = purchases[_buyer][_vestedPurchaseId];
        require(tokensToRefund > 0, ERROR_NOTHING_TO_REFUND);
        purchases[_buyer][_vestedPurchaseId] = 0;

        // (presale) ~~~> contribution tokens ~~~> (buyer)
        require(contributionToken.transfer(_buyer, tokensToRefund), ERROR_TOKEN_TRANSFER_REVERTED);

        // (buyer) ~~~> project tokens ~~~> (Token manager)
        // Note: this assumes that the buyer didn't transfer any of the vested tokens.
        // The assumption can be made, considering the imposed restriction of presalePeriod < vestingCliffPeriod < vestingCompletePeriod.
        (uint256 tokensSold,,,,) = projectTokenManager.getVesting(_buyer, _vestedPurchaseId);
        projectTokenManager.revokeVesting(_buyer, _vestedPurchaseId);

        // (Token manager) ~~~> project tokens ~~~> (burn 💥)
        projectTokenManager.burn(address(projectTokenManager), tokensSold);

        emit TokensRefunded(_buyer, tokensToRefund, tokensSold, _vestedPurchaseId);
    }

    /**
    * @notice Closes a sale that has reached the funding goal, sending raised funds to the fundraising pool and the beneficiary address, and initializes the Fundraising app by adding the raised funds as collateral tokens.
    */
    function close() public {
        require(currentSaleState() == SaleState.GoalReached, ERROR_INVALID_STATE);

        // (presale) ~~~> contribution tokens ~~~> (beneficiary)
        uint256 tokensForBeneficiary = totalRaised.mul(percentFundingForBeneficiary).div(PPM);
        require(contributionToken.transfer(beneficiary, tokensForBeneficiary), ERROR_TOKEN_TRANSFER_REVERTED);

        // (presale) ~~~> contribution tokens ~~~> (pool)
        uint256 tokensForPool = contributionToken.balanceOf(address(this));
        require(contributionToken.transfer(reserve, tokensForPool), ERROR_TOKEN_TRANSFER_REVERTED);

        saleClosed = true;

        emit SaleClosed();
    }

    /*
     * Getters
     */

    /**
    * @notice Calculates the number of project tokens that would be obtained for `_amount` contribution tokens.
    * @param _amount uint256 The amount of contribution tokens to be converted into project tokens.
    */
    function contributionToProjectTokens(uint256 _amount) public view returns (uint256) {
        return _amount.mul(tokenExchangeRate);
    }

    /**
    * @notice Calculates the current state of the sale.
    */
    function currentSaleState() public view returns (SaleState) {

        if (startDate == 0 || startDate > getTimestamp64()) {
            return SaleState.Pending;
        }

        if (totalRaised >= presaleGoal) {
            if (saleClosed) {
                return SaleState.Closed;
            } else {
                return SaleState.GoalReached;
            }
        }

        if (_timeSinceFundingStarted() < presalePeriod) {
            return SaleState.Funding;
        } else {
            return SaleState.Refunding;
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

    function _timeSinceFundingStarted() private view returns (uint64) {
        if (startDate == 0) {
            return 0;
        } else {
            return getTimestamp64().sub(startDate);
        }
    }

    function _calculateExchangeRate() private {
        tokenExchangeRate = presaleGoal.mul(PPM).mul(percentSupplyOffered).div(CONNECTOR_WEIGHT_PPM).div(PPM);
    }

    function _setProjectToken(MiniMeToken _projectToken, TokenManager _projectTokenManager) private {
        require(isContract(_projectTokenManager), ERROR_INVALID_TOKEN_CONTROLLER);
        require(_projectTokenManager.token() == address(_projectToken), ERROR_INVALID_TOKEN_CONTROLLER);
        projectToken = _projectToken;
        projectTokenManager = _projectTokenManager;
    }
}
