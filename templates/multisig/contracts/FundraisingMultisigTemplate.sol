pragma solidity 0.4.24;

import "@aragon/apps-agent/contracts/Agent.sol";
import "@aragon/templates-shared/contracts/BaseTemplate.sol";
import "@ablack/fundraising-bancor-formula/contracts/BancorFormula.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";
import {AragonFundraisingController as Controller} from "@ablack/fundraising-aragon-fundraising/contracts/AragonFundraisingController.sol";
import {BatchedBancorMarketMaker as MarketMaker} from "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";


contract FundraisingMultisigTemplate is BaseTemplate {
    string constant private ERROR_EMPTY_BOARD = "FM_EMPTY_BOARD";
    string constant private ERROR_BAD_VOTE_SETTINGS = "FM_BAD_VOTE_SETTINGS";
    string constant private ERROR_BAD_FUNDRAISING_SETTINGS = "FM_BAD_FUNDRAISING_SETTINGS";
    string constant private ERROR_MISSING_CACHE = "FM_MISSING_CACHE";

    bool    constant private BOARD_TRANSFERABLE = false;
    uint8   constant private BOARD_TOKEN_DECIMALS = uint8(0);
    uint256 constant private BOARD_MAX_PER_ACCOUNT = uint256(1);

    bool    constant private SHARE_TRANSFERABLE = true;
    uint8   constant private SHARE_TOKEN_DECIMALS = uint8(18);
    uint256 constant private SHARE_MAX_PER_ACCOUNT = uint256(0);

    uint64 constant private SHARE_VOTE_DURATION = uint64(1 weeks);
    uint64 constant private SHARE_SUPPORT_REQUIRED = uint64(50 * 10**16);
    uint64 constant private SHARE_MIN_ACCEPTANCE_QUORUM = uint64(0);
    uint64[3]       private SHARE_VOTING_SETTINGS = [SHARE_SUPPORT_REQUIRED, SHARE_MIN_ACCEPTANCE_QUORUM, SHARE_VOTE_DURATION];

    uint64 constant private DEFAULT_FINANCE_PERIOD = uint64(30 days);

    uint256 constant BATCH_BLOCKS = uint256(1);
    uint256 constant BUY_FEE = uint256(0);
    uint256 constant SELL_FEE = uint256(0);

    uint32 constant private DAI_RESERVE_RATIO = 100000; // 10%
    uint32 constant private ANT_RESERVE_RATIO = 10000;  // 1%

    bytes32 constant private BANCOR_FORMULA_ID = apmNamehash("bancor-formula");
    bytes32 constant private MARKET_MAKER_ID = apmNamehash("batched-bancor-market-maker");
    bytes32 constant private TAP_ID = apmNamehash("tap");
    bytes32 constant private ARAGON_FUNDRAISING_ID = apmNamehash("aragon-fundraising");

    struct Cache {
        address dao;
        address boardTokenManager;
        address boardVoting;
        address vault;
        address finance;
        address shareVoting;
        address shareTokenManager;
        address reserve;
        address marketMaker;
        address tap;
        address controller;
    }

    mapping (address => Cache) internal cache;

    constructor(DAOFactory _daoFactory, ENS _ens, MiniMeTokenFactory _miniMeFactory, IFIFSResolvingRegistrar _aragonID)
        BaseTemplate(_daoFactory, _ens, _miniMeFactory, _aragonID)
        public
    {
        _ensureAragonIdIsValid(_aragonID);
        _ensureMiniMeFactoryIsValid(_miniMeFactory);
    }

    function deployBaseInstance(
        string    _boardTokenName,
        string    _boardTokenSymbol,
        address[] _boardMembers,
        uint64[3] _boardVotingSettings,
        uint64    _financePeriod
    )
        external
    {
        _ensureBoardSetting(_boardMembers, _boardVotingSettings);


        (Kernel dao, ACL acl) = _createDAO();
        MiniMeToken boardToken = _createToken(_boardTokenName, _boardTokenSymbol, BOARD_TOKEN_DECIMALS);
        (TokenManager tm,,,) = _installBoardApps(dao, boardToken, _boardVotingSettings, _financePeriod);

        _mintTokens(acl, tm, _boardMembers, 1);
        _setupBoardPermissions(dao);
    }

    function installFundraisingApps(
        string _id,
        string _shareTokenName,
        string _shareTokenSymbol,
        uint64[3] _shareVotingSettings,
        uint256 _maxTapIncreasePct
    )
        external
    {
        _ensureShareSetting(_shareVotingSettings);
        _ensureBoardAppsCache();

        Kernel dao = _popDaoCache();
        MiniMeToken shareToken = _createToken(_shareTokenName, _shareTokenSymbol, SHARE_TOKEN_DECIMALS);

        _installShareApps(dao, shareToken, _shareVotingSettings);
        _installFundraisingApps(dao, _maxTapIncreasePct);

        _setupSharePermissions(dao);
        _setupFundraisingPermissions(dao);

        _registerID(_id, address(dao));
    }

    function finalizeInstance(
        address[2] _collaterals,
        uint256[2] _virtualSupplies,
        uint256[2] _virtualBalances,
        uint256[2] _slippages,
        uint256[2] _taps,
        uint256[2] _floors
    )
        external
    {
        _ensureFundraisingSettings(_collaterals, _virtualSupplies, _virtualBalances, _slippages, _taps, _floors);
        _ensureShareAppsCache();
        _ensureFundraisingAppsCache();

        Kernel dao = _popDaoCache();
        (, Voting shareVoting) = _popShareAppsCache();

        _setupCollateralTokens(dao, _collaterals, _virtualSupplies, _virtualBalances, _slippages, _taps, _floors);
        _setupControllerPermissions(dao);

        _transferRootPermissionsFromTemplateAndFinalizeDAO(dao, shareVoting, shareVoting);

        _clearCache();
    }

    function _installBoardApps(Kernel _dao, MiniMeToken _token, uint64[3] _votingSettings, uint64 _financePeriod)
        internal
        returns (TokenManager tm, Voting voting, Vault vault, Finance finance)
    {
        tm = _installTokenManagerApp(_dao, _token, BOARD_TRANSFERABLE, BOARD_MAX_PER_ACCOUNT);
        voting = _installVotingApp(_dao, _token, _votingSettings);
        vault = _installVaultApp(_dao);
        finance = _installFinanceApp(_dao, vault, _financePeriod == 0 ? DEFAULT_FINANCE_PERIOD : _financePeriod);

        _cacheBoardApps(tm, voting, vault, finance);
    }

    function _installShareApps(Kernel _dao, MiniMeToken _shareToken, uint64[3] _shareVotingSettings)
        internal
        returns (TokenManager tm, Voting voting)
    {
        tm = _installTokenManagerApp(_dao, _shareToken, SHARE_TRANSFERABLE, SHARE_MAX_PER_ACCOUNT);
        voting = _installVotingApp(_dao, _shareToken, _shareVotingSettings);

        _cacheShareApps(tm, voting);
    }

    function _installFundraisingApps(Kernel _dao, uint256 _maxTapIncreasePct)
        internal
        returns (Agent reserve, MarketMaker marketMaker, Tap tap, Controller controller)
    {
        reserve = _installNonDefaultAgentApp(_dao);
        marketMaker = MarketMaker(_registerApp(_dao, MARKET_MAKER_ID));
        tap = Tap(_registerApp(_dao, TAP_ID));
        controller = Controller(_registerApp(_dao, ARAGON_FUNDRAISING_ID));

        _cacheFundraisingApps(reserve, marketMaker, tap, controller);
        _initializeFundraisingApps(_maxTapIncreasePct);
    }

    function _initializeFundraisingApps(uint256 _maxTapIncreasePct) internal {
        _initializeMarketMaker();
        _initializeTap(_maxTapIncreasePct);
        _initializeController();
    }

    function _initializeMarketMaker() internal {
        IBancorFormula bancorFormula = IBancorFormula(_latestVersionAppBase(BANCOR_FORMULA_ID));

        (,, Vault beneficiary,) = _popBoardAppsCache();
        (TokenManager shareTM,) = _popShareAppsCache();
        (Agent reserve, MarketMaker marketMaker,, Controller controller) = _popFundraisingAppsCache();

        marketMaker.initialize(controller, shareTM, reserve, beneficiary, bancorFormula, BATCH_BLOCKS, BUY_FEE, SELL_FEE);
    }

    function _initializeTap(uint256 _maxTapIncreasePct) internal {
        (,, Vault beneficiary,) = _popBoardAppsCache();
        (Agent reserve,, Tap tap, Controller controller) = _popFundraisingAppsCache();

        tap.initialize(controller, reserve, beneficiary, BATCH_BLOCKS, _maxTapIncreasePct);
    }

    function _initializeController() internal {
        (Agent reserve, MarketMaker marketMaker, Tap tap, Controller controller) = _popFundraisingAppsCache();

        controller.initialize(marketMaker, reserve, tap);
    }

    function _setupCollateralTokens(
        Kernel _dao,
        address[2] _collaterals,
        uint256[2] _virtualSupplies,
        uint256[2] _virtualBalances,
        uint256[2] _slippages,
        uint256[2] _taps,
        uint256[2] _floors
    )
        internal
    {
        ACL acl = ACL(_dao.acl());
        (,,, Controller c) = _popFundraisingAppsCache();

        acl.createPermission(this, c, c.ADD_COLLATERAL_TOKEN_ROLE(), this);

        c.addCollateralToken(_collaterals[0], _virtualSupplies[0], _virtualBalances[0], DAI_RESERVE_RATIO, _slippages[0], _taps[0], _floors[0]);
        c.addCollateralToken(_collaterals[1], _virtualSupplies[1], _virtualBalances[1], ANT_RESERVE_RATIO, _slippages[1], _taps[1], _floors[1]);
    }

    function _setupBoardPermissions(Kernel _dao) internal {
        (TokenManager tm, Voting voting, Vault vault, Finance finance) = _popBoardAppsCache();

        ACL acl = ACL(_dao.acl());

        _createTokenManagerPermissions(acl, tm, voting, voting);
        _createVotingPermissions(acl, voting, voting, tm, voting);
        _createVaultPermissions(acl, vault, finance, voting);
        _createFinancePermissions(acl, finance, voting, voting);
    }

    function _setupSharePermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (TokenManager boardTM,,,) = _popBoardAppsCache();
        (TokenManager shareTM, Voting shareVoting) = _popShareAppsCache();
        (, MarketMaker marketMaker,,) = _popFundraisingAppsCache();

        _createTokenManagerPermissions(acl, shareTM, marketMaker, shareVoting);
        _createVotingPermissions(acl, shareVoting, shareVoting, boardTM, shareVoting);
    }

    function _setupFundraisingPermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (, Voting _boardVoting,,) = _popBoardAppsCache();
        (, Voting _shareVoting) = _popShareAppsCache();
        (Agent _reserve, MarketMaker _marketMaker, Tap _tap, Controller _controller) = _popFundraisingAppsCache();

        _createReservePermissions(acl, _reserve, _marketMaker, _tap, _controller, _shareVoting);
        _createMarketMakerPermissions (acl, _marketMaker, _controller, _shareVoting);
        _createTapPermissions(acl, _tap, _controller, _boardVoting, _shareVoting);
        // _createControllerPermissions(acl, _controller, _boardVoting, _shareVoting); // gonna do that after we add collaterals
    }

    function _setupControllerPermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (, Voting boardVoting,,) = _popBoardAppsCache();
        (, Voting shareVoting) = _popShareAppsCache();
        (,,, Controller controller) = _popFundraisingAppsCache();

        _createControllerPermissions(acl, controller, boardVoting, shareVoting);
    }

    function _createReservePermissions(
        ACL _acl,
        Agent _reserve,
        MarketMaker _marketMaker,
        Tap _tap,
        Controller _controller,
        Voting _shareVoting
    )
        internal
    {
        address[] memory grantees = new address[](2);
        grantees[0] = address(_tap);
        grantees[1] = address(_marketMaker);

        _acl.createPermission(_shareVoting, _reserve, _reserve.SAFE_EXECUTE_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _reserve, _reserve.ADD_PROTECTED_TOKEN_ROLE(), _shareVoting);
        _createPermissions(_acl, grantees, _reserve, _reserve.TRANSFER_ROLE(), _shareVoting);
    }

    function _createMarketMakerPermissions(ACL _acl, MarketMaker _marketMaker, Controller _controller, Voting _shareVoting) internal {
        _acl.createPermission(_controller, _marketMaker, _marketMaker.ADD_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _marketMaker, _marketMaker.REMOVE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _marketMaker, _marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _marketMaker, _marketMaker.UPDATE_BENEFICIARY_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _marketMaker, _marketMaker.UPDATE_FEES_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _marketMaker, _marketMaker.OPEN_BUY_ORDER_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _marketMaker, _marketMaker.OPEN_SELL_ORDER_ROLE(), _shareVoting);
    }

    function _createTapPermissions(ACL _acl, Tap _tap, Controller _controller, Voting _boardVoting, Voting _shareVoting) internal {
        _acl.createPermission(_controller, _tap, _tap.UPDATE_BENEFICIARY_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _tap, _tap.UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _tap, _tap.ADD_TAPPED_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _tap, _tap.UPDATE_TAPPED_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_controller, _tap, _tap.WITHDRAW_ROLE(), _boardVoting);
    }

    function _createControllerPermissions(ACL _acl, Controller _controller, Voting _boardVoting, Voting _shareVoting) internal {
        _transferPermissionFromTemplate(_acl, _controller, _shareVoting, _controller.ADD_COLLATERAL_TOKEN_ROLE(), _shareVoting);

        _acl.createPermission(_boardVoting, _controller, _controller.UPDATE_BENEFICIARY_ROLE(), _boardVoting);
        _acl.createPermission(_boardVoting, _controller, _controller.WITHDRAW_ROLE(), _boardVoting);
        _acl.createPermission(_shareVoting, _controller, _controller.UPDATE_FEES_ROLE(), _shareVoting);
        _acl.createPermission(_shareVoting, _controller, _controller.UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE(), _shareVoting);
        // _acl.createPermission(_shareVoting, _controller, _controller.ADD_COLLATERAL_TOKEN_ROLE(), _shareVoting); // already transferred above
        _acl.createPermission(_shareVoting, _controller, _controller.REMOVE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_shareVoting, _controller, _controller.UPDATE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        _acl.createPermission(_shareVoting, _controller, _controller.UPDATE_TOKEN_TAP_ROLE(), _shareVoting);
        _acl.createPermission(address(-1), _controller, _controller.OPEN_BUY_ORDER_ROLE(), _shareVoting);
        _acl.createPermission(address(-1), _controller, _controller.OPEN_SELL_ORDER_ROLE(), _shareVoting);
    }

    function _cacheDao(Kernel _dao) internal {
        Cache storage c = cache[msg.sender];

        c.dao = address(_dao);
    }

    function _cacheBoardApps(TokenManager _tm, Voting _voting, Vault _vault, Finance _finance) internal {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        c.boardTokenManager = address(_tm);
        c.boardVoting = address(_voting);
        c.vault = address(_vault);
        c.finance = address(_finance);
    }

    function _cacheShareApps(TokenManager _tm, Voting _voting) internal {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        c.shareTokenManager = address(_tm);
        c.shareVoting = address(_voting);
    }

    function _cacheFundraisingApps(Agent _reserve, MarketMaker _marketMaker, Tap _tap, Controller _controller) internal {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        c.reserve = address(_reserve);
        c.marketMaker = address(_marketMaker);
        c.tap = address(_tap);
        c.controller = address(_controller);
    }

    function _popDaoCache() internal returns (Kernel dao) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        dao = Kernel(c.dao);
    }

    function _popBoardAppsCache() internal returns (
        TokenManager tm,
        Voting voting,
        Vault vault,
        Finance finance
    )
    {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        tm = TokenManager(c.boardTokenManager);
        voting = Voting(c.boardVoting);
        vault = Vault(c.vault);
        finance = Finance(c.finance);
    }

    function _popShareAppsCache() internal returns (TokenManager tm, Voting voting) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        tm = TokenManager(c.shareTokenManager);
        voting = Voting(c.shareVoting);
    }

    function _popFundraisingAppsCache() internal returns (Agent reserve, MarketMaker marketMaker, Tap tap, Controller controller) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        reserve = Agent(c.reserve);
        marketMaker = MarketMaker(c.marketMaker);
        tap = Tap(c.tap);
        controller = Controller(c.controller);
    }

    function _clearCache() internal {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        delete c.dao;
        delete c.boardTokenManager;
        delete c.boardVoting;
        delete c.vault;
        delete c.finance;
        delete c.shareVoting;
        delete c.shareTokenManager;
        delete c.reserve;
        delete c.marketMaker;
        delete c.tap;
        delete c.controller;
    }

    function _ensureBoardAppsCache() internal {
        Cache storage c = cache[msg.sender];
        require(c.boardTokenManager != address(0), ERROR_MISSING_CACHE);
        require(c.boardVoting != address(0), ERROR_MISSING_CACHE);
        require(c.vault != address(0), ERROR_MISSING_CACHE);
        require(c.finance != address(0), ERROR_MISSING_CACHE);
    }

    function _ensureShareAppsCache() internal {
        Cache storage c = cache[msg.sender];
        require(c.shareTokenManager != address(0), ERROR_MISSING_CACHE);
        require(c.shareVoting != address(0), ERROR_MISSING_CACHE);
    }

    function _ensureFundraisingAppsCache() internal {
        Cache storage c = cache[msg.sender];
        require(c.reserve != address(0), ERROR_MISSING_CACHE);
        require(c.marketMaker != address(0), ERROR_MISSING_CACHE);
        require(c.tap != address(0), ERROR_MISSING_CACHE);
        require(c.controller != address(0), ERROR_MISSING_CACHE);
    }

    function _ensureBoardSetting(address[] _members, uint64[3] _votingSettings) internal {
        require(_members.length > 0, ERROR_EMPTY_BOARD);
        require(_votingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);
    }

    function _ensureShareSetting(uint64[3] _votingSettings) internal {
        require(_votingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);
    }

    function _ensureFundraisingSettings(
        address[2] _collaterals,
        uint256[2] _virtualSupplies,
        uint256[2] _virtualBalances,
        uint256[2] _slippages,
        uint256[2] _taps,
        uint256[2] _floors
    )
        internal
    {
        require(_collaterals.length == 2, ERROR_BAD_FUNDRAISING_SETTINGS);
        require(_virtualSupplies.length == 2, ERROR_BAD_FUNDRAISING_SETTINGS);
        require(_virtualBalances.length == 2, ERROR_BAD_FUNDRAISING_SETTINGS);
        require(_slippages.length == 2, ERROR_BAD_FUNDRAISING_SETTINGS);
        require(_taps.length == 2, ERROR_BAD_FUNDRAISING_SETTINGS);
        require(_floors.length == 2, ERROR_BAD_FUNDRAISING_SETTINGS);
    }

    function _registerApp(Kernel _dao, bytes32 _appId) internal returns (address) {
        address proxy = _dao.newAppInstance(_appId, _latestVersionAppBase(_appId));
        emit InstalledApp(proxy, _appId);

        return proxy;
    }

    function _createDAO() internal returns (Kernel dao, ACL acl) {
        (dao, acl) = super._createDAO();

        _cacheDao(dao);
    }
}
