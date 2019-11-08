pragma solidity ^0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/os/contracts/common/SafeERC20.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";
import "@aragon/os/contracts/lib/math/SafeMath64.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@ablack/fundraising-shared-interfaces/contracts/IAragonFundraisingController.sol";

import "./IPresale.sol";


contract BalanceRedirectPresale is IsContract, AragonApp, IPresale {
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

    uint256 public constant PPM = 1000000; // 0% = 0 * 10 ** 4; 1% = 1 * 10 ** 4; 100% = 100 * 10 ** 4

    string private constant ERROR_CONTRACT_IS_EOA          = "PRESALE_CONTRACT_IS_EOA";
    string private constant ERROR_INVALID_BENEFICIARY      = "PRESALE_INVALID_BENEFICIARY";
    string private constant ERROR_INVALID_CONTRIBUTE_TOKEN = "PRESALE_INVALID_CONTRIBUTE_TOKEN";
    string private constant ERROR_INVALID_EXCHANGE_RATE    = "PRESALE_INVALID_EXCHANGE_RATE";
    string private constant ERROR_INVALID_TIME_PERIOD      = "PRESALE_INVALID_TIME_PERIOD";
    string private constant ERROR_INVALID_PCT              = "PRESALE_INVALID_PCT";
    string private constant ERROR_INVALID_STATE            = "PRESALE_INVALID_STATE";
    string private constant ERROR_INVALID_CONTRIBUTE_VALUE = "PRESALE_INVALID_CONTRIBUTE_VALUE";
    string private constant ERROR_INSUFFICIENT_BALANCE     = "PRESALE_INSUFFICIENT_BALANCE";
    string private constant ERROR_INSUFFICIENT_ALLOWANCE   = "PRESALE_INSUFFICIENT_ALLOWANCE";
    string private constant ERROR_TOKEN_TRANSFER_REVERTED  = "PRESALE_TOKEN_TRANSFER_REVERTED";

    enum State {
        Pending,     // presale is idle and pending to be started
        Funding,     // presale has started and contributors can purchase tokens
        Closed       // presale has reached goal within period, has been closed and trading has been open
    }

    IAragonFundraisingController                    public controller;
    TokenManager                                    public tokenManager;
    ERC20                                           public token;
    address                                         public reserve;
    address                                         public beneficiary;
    ERC20                                           public contributionToken;

    uint64                                          public period;
    uint256                                         public exchangeRate;
    uint256                                         public futureReserveRatio;
    uint64                                          public openDate;

    bool                                            public isClosed;
    uint256                                         public totalRaised;

    event SetOpenDate (uint64 date);
    event Close       ();
    event Contribute  (address indexed contributor, uint256 value, uint256 amount);


    /***** external function *****/

    /**
     * @notice Initialize presale
     * @param _controller               The address of the controller contract
     * @param _tokenManager             The address of the [bonded] token manager contract
     * @param _reserve                  The address of the reserve [pool] contract
     * @param _beneficiary              The address of the beneficiary [to whom a percentage of the raised funds is be to be sent]
     * @param _contributionToken        The address of the token to be used to contribute
     * @param _period                   The period within which to accept contribution for that presale
     * @param _exchangeRate             The exchangeRate [= 1/price] at which [bonded] tokens are to be purchased for that presale [in PPM]
     * @param _futureReserveRatio       The reserve ratio of the bonding curve that will be opened after the presale is closed
     * @param _openDate                 The date upon which that presale is to be open [ignored if 0]
    */
    function initialize(
        IAragonFundraisingController _controller,
        TokenManager                 _tokenManager,
        address                      _reserve,
        address                      _beneficiary,
        ERC20                        _contributionToken,
        uint64                       _period,
        uint256                      _exchangeRate,
        uint256                      _futureReserveRatio,
        uint64                       _openDate
    )
        external
        onlyInit
    {
        require(isContract(_controller),                                            ERROR_CONTRACT_IS_EOA);
        require(isContract(_tokenManager),                                          ERROR_CONTRACT_IS_EOA);
        require(isContract(_reserve),                                               ERROR_CONTRACT_IS_EOA);
        require(_beneficiary != address(0),                                         ERROR_INVALID_BENEFICIARY);
        require(isContract(_contributionToken),                                     ERROR_INVALID_CONTRIBUTE_TOKEN);
        require(_period > 0,                                                        ERROR_INVALID_TIME_PERIOD);
        require(_exchangeRate > 0,                                                  ERROR_INVALID_EXCHANGE_RATE);
        require(_futureReserveRatio > 0 && _futureReserveRatio <= PPM, ERROR_INVALID_PCT);

        initialized();

        controller = _controller;
        tokenManager = _tokenManager;
        token = ERC20(_tokenManager.token());
        reserve = _reserve;
        beneficiary = _beneficiary;
        contributionToken = _contributionToken;
        period = _period;
        exchangeRate = _exchangeRate;
        futureReserveRatio = _futureReserveRatio;

        if (_openDate != 0) {
            _setOpenDate(_openDate);
        }
    }

    /**
     * @notice Open presale [enabling users to contribute]
    */
    function open() external auth(OPEN_ROLE) {
        require(state() == State.Pending, ERROR_INVALID_STATE);

        _setOpenDate(getTimestamp64());
    }

    /**
     * @notice Contribute to the presale up to `@tokenAmount(self.contributionToken(): address, _value)`
     * @param _contributor The address of the contributor
     * @param _value       The amount of contribution token to be spent
    */
    function contribute(address _contributor, uint256 _value) external payable nonReentrant auth(CONTRIBUTE_ROLE) {
        require(state() == State.Funding, ERROR_INVALID_STATE);
        require(msg.value == 0,                                                    ERROR_INVALID_CONTRIBUTE_VALUE);
        require(_value > 0,                                                        ERROR_INVALID_CONTRIBUTE_VALUE);
        require(contributionToken.balanceOf(_contributor) >= _value,               ERROR_INSUFFICIENT_BALANCE);
        require(contributionToken.allowance(_contributor, address(this)) >= _value, ERROR_INSUFFICIENT_ALLOWANCE);

        // (contributor) ~~~> contribution tokens ~~~> (presale)
        _transfer(contributionToken, _contributor, address(this), _value);

        // (mint ✨) ~~~> project tokens ~~~> (contributor)
        uint256 tokensToSell = contributionToTokens(_value);
        tokenManager.mint(_contributor, tokensToSell);
        totalRaised = totalRaised.add(_value);

        emit Contribute(_contributor, _value, tokensToSell);
    }

    /**
     * @notice Does nothing. Interface compliance.
    */
    function refund(address, uint256) external isInitialized {
        return;
    }

    /**
     * @notice Close presale and open trading
    */
    function close() external nonReentrant isInitialized {
        require(state() == State.Funding, ERROR_INVALID_STATE);

        isClosed = true;

        // (presale) ~~~> contribution tokens ~~~> (reserve)
        uint256 tokensForReserve = totalRaised.mul(futureReserveRatio) / PPM;
        _transfer(contributionToken, address(this), reserve, tokensForReserve);

        // (presale) ~~~> contribution tokens ~~~> (beneficiary)
        uint256 fundsForBeneficiary = contributionToken.balanceOf(address(this));
        if (fundsForBeneficiary > 0) {
            _transfer(contributionToken, address(this), beneficiary, fundsForBeneficiary);
        }

        // open trading
        controller.openTrading();

        emit Close();
    }

    /***** public view functions *****/

    /**
     * @notice Computes the amount of [bonded] tokens that would be purchased for `@tokenAmount(self.contributionToken(): address, _value)`
     * @param _value The amount of contribution tokens to be used in that computation
    */
    function contributionToTokens(uint256 _value) public view isInitialized returns (uint256) {
        return _value.mul(exchangeRate).div(PPM);
    }

    /**
     * @notice Returns the current state of that presale
    */
    function state() public view isInitialized returns (State) {
        if (openDate == 0 || openDate > getTimestamp64()) {
            return State.Pending;
        }

        if (isClosed || _timeSinceOpen() >= period) {
            return State.Closed;
        }

        return State.Funding;
    }

    /***** internal functions *****/

    function _timeSinceOpen() internal view returns (uint64) {
        if (openDate == 0) {
            return 0;
        } else {
            return getTimestamp64().sub(openDate);
        }
    }

    function _setOpenDate(uint64 _date) internal {
        require(_date >= getTimestamp64(), ERROR_INVALID_TIME_PERIOD);

        openDate = _date;

        emit SetOpenDate(_date);
    }

    function _transfer(address _token, address _from, address _to, uint256 _amount) internal {
        if (_from == address(this)) {
            require(ERC20(_token).safeTransfer(_to, _amount), ERROR_TOKEN_TRANSFER_REVERTED);
        } else {
            require(ERC20(_token).safeTransferFrom(_from, _to, _amount), ERROR_TOKEN_TRANSFER_REVERTED);
        }
    }
}
