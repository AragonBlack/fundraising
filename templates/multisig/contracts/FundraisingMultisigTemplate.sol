pragma solidity 0.4.24;

import "@aragon/apps-agent/contracts/Agent.sol";
import {AragonFundraisingController as Controller} from "@ablack/fundraising-aragon-fundraising/contracts/AragonFundraisingController.sol";
import {BatchedBancorMarketMaker as MarketMaker} from "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";
import "@ablack/fundraising-bancor-formula/contracts/BancorFormula.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";
import "@aragon/templates-shared/contracts/BaseTemplate.sol";


contract FundraisingMultisigTemplate is BaseTemplate {
    string constant private ERROR_MISSING_CACHE = "COMPANYBD_MISSING_CACHE";
    string constant private ERROR_MISSING_BOARD_MEMBERS = "COMPANYBD_MISSING_BOARD_MEMBERS";
    string constant private ERROR_MISSING_SHARE_MEMBERS = "COMPANYBD_MISSING_SHARE_MEMBERS";
    string constant private ERROR_BAD_HOLDERS_STAKES_LEN = "COMPANYBD_BAD_HOLDERS_STAKES_LEN";
    string constant private ERROR_BAD_VOTE_SETTINGS = "COMPANYBD_BAD_VOTE_SETTINGS";
    string constant private ERROR_BAD_PAYROLL_SETTINGS = "COMPANYBD_BAD_PAYROLL_SETTINGS";

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

    uint256 constant private DAI_VIRTUAL_SUPPLY = 10**18; // 1 DAI
    uint256 constant private ANT_VIRTUAL_SUPPLY = 10**18; // 1 ANT

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
        string _boardTokenName,
        string _boardTokenSymbol,
        address[] _boardMembers,
        uint64[3] _boardVotingSettings,
        uint64 _financePeriod
    )
        external
    {
        require(_boardVotingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);


        (Kernel dao, ACL acl)  = _createDAO();
        MiniMeToken boardToken = _createToken(_boardTokenName, _boardTokenSymbol, BOARD_TOKEN_DECIMALS);
        (TokenManager tm,,,)   = _installBoardApps(dao, boardToken, _boardVotingSettings, _financePeriod);

        _mintTokens(acl, tm, _boardMembers, 1);
        _setupBoardPermissions(dao);
    }


    function installFundraisingApps(string _id, string _shareTokenName, string _shareTokenSymbol, uint64[3] _shareVotingSettings) external {
    //     // _ensureFinalizationSettings(_shareHolders, _shareStakes, _boardMembers);

        Kernel dao = _popDaoCache();
        MiniMeToken shareToken = _createToken(_shareTokenName, _shareTokenSymbol, SHARE_TOKEN_DECIMALS);

        _installShareApps(dao, shareToken, _shareVotingSettings);
        _installFundraisingApps(dao);

        _setupSharePermissions(dao);
        _setupFundraisingPermissions(dao);

        _registerID(_id, address(dao));
    }

    function finalizeInstance(address[] _collaterals, uint256[] _virtualBalances, uint256[] _slippages, uint256[] _taps, uint256[] _floors) external {
        Kernel dao = _popDaoCache();
        (, Voting shareVoting) = _popShareAppsCache();

        _setupCollateralTokens(dao, _collaterals, _virtualBalances, _slippages, _taps, _floors);
        _setupControllerPermissions(dao);

        _transferRootPermissionsFromTemplateAndFinalizeDAO(dao, shareVoting, shareVoting);

        _clearCache();
    }

    function _createDAO() internal returns (Kernel dao, ACL acl) {
        (dao, acl) = super._createDAO();

        _cacheDao(dao);
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

    function _installShareApps(Kernel _dao, MiniMeToken _shareToken, uint64[3] _shareVotingSettings) internal returns (TokenManager tm, Voting voting) {
        tm = _installTokenManagerApp(_dao, _shareToken, SHARE_TRANSFERABLE, SHARE_MAX_PER_ACCOUNT);
        voting = _installVotingApp(_dao, _shareToken, _shareVotingSettings);

        _cacheShareApps(tm, voting);
    }

    function _installFundraisingApps(Kernel _dao) internal returns (Agent reserve, MarketMaker marketMaker, Tap tap, Controller controller) {
        bytes32[4] memory apps = [
            apmNamehash("pool"),   // 0
            // apmNamehash("bancor-formula"), //4
            apmNamehash("batched-bancor-market-maker"), // 3
            apmNamehash("tap"),    // 1
            apmNamehash("aragon-fundraising")        // 2
        ];

        (TokenManager boardTM, Voting boardVoting, Vault beneficiary,) = _popBoardAppsCache();
        (TokenManager shareTM, Voting shareVoting) = _popShareAppsCache();

        reserve = Agent(_registerApp(_dao, apps[0]));
        marketMaker = MarketMaker(_registerApp(_dao, apps[1]));
        tap = Tap(_registerApp(_dao, apps[2]));
        controller = Controller(_registerApp(_dao, apps[3]));


        reserve.initialize();
        marketMaker.initialize(controller, shareTM, reserve, beneficiary, IBancorFormula(_latestVersionAppBase(apmNamehash("bancor-formula"))), BATCH_BLOCKS, BUY_FEE, SELL_FEE);
        tap.initialize(controller, reserve, beneficiary, BATCH_BLOCKS, uint256(50 * 10 ** 16));
        controller.initialize(marketMaker, reserve, tap);

        _cacheFundraisingApps(reserve, marketMaker, tap, controller);
    }

    function _registerApp(Kernel _dao, bytes32 _appId) internal returns (address) {
        address proxy = _dao.newAppInstance(_appId, _latestVersionAppBase(_appId));
        emit InstalledApp(proxy, _appId);

        return proxy;
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
        // _createControllerPermissions(acl, _controller, _boardVoting, _shareVoting);
    
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

    function _createControllerPermissions(ACL _acl, Controller _controller, Voting _board, Voting _share) internal {
        _transferPermissionFromTemplate(_acl, _controller, _share, _controller.ADD_COLLATERAL_TOKEN_ROLE(), _share);

        _acl.createPermission(_board, _controller, _controller.UPDATE_BENEFICIARY_ROLE(), _board);
        _acl.createPermission(_board, _controller, _controller.WITHDRAW_ROLE(), _board);
        _acl.createPermission(_share, _controller, _controller.UPDATE_FEES_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE(), _share);
        // _acl.createPermission(_share, _controller, _controller.ADD_COLLATERAL_TOKEN_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.REMOVE_COLLATERAL_TOKEN_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.UPDATE_COLLATERAL_TOKEN_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.UPDATE_TOKEN_TAP_ROLE(), _share);
        _acl.createPermission(address(-1), _controller, _controller.OPEN_BUY_ORDER_ROLE(), _share);
        _acl.createPermission(address(-1), _controller, _controller.OPEN_SELL_ORDER_ROLE(), _share);
    }

    function _setupCollateralTokens(Kernel _dao, address[] _collaterals, uint256[] _virtualBalances, uint256[] _slippages, uint256[] _taps, uint256[] _floors) internal {
        ACL acl = ACL(_dao.acl());
        (,,, Controller controller) = _popFundraisingAppsCache();

        acl.createPermission(this, controller, controller.ADD_COLLATERAL_TOKEN_ROLE(), this);

        controller.addCollateralToken(_collaterals[0], DAI_VIRTUAL_SUPPLY, _virtualBalances[0], DAI_RESERVE_RATIO, _slippages[0], _taps[0], _floors[0]);
        controller.addCollateralToken(_collaterals[1], ANT_VIRTUAL_SUPPLY, _virtualBalances[1], ANT_RESERVE_RATIO, _slippages[1], _taps[1], _floors[1]) ;

        
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
        TokenManager boardTokenManager,
        Voting boardVoting,
        Vault vault,
        Finance finance
    ) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        boardTokenManager = TokenManager(c.boardTokenManager);
        boardVoting = Voting(c.boardVoting);
        vault = Vault(c.vault);
        finance = Finance(c.finance);
    }

    function _popShareAppsCache() internal returns (TokenManager shareTokenManager, Voting shareVoting) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        shareTokenManager = TokenManager(c.shareTokenManager);
        shareVoting = Voting(c.shareVoting);
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

    // function _ensureFinalizationSettings(
    //     address[] memory _shareHolders,
    //     uint256[] memory _shareStakes,
    //     address[] memory _boardMembers
    // )
    //     private
    //     pure
    // {
    //     require(_shareHolders.length > 0, ERROR_MISSING_SHARE_MEMBERS);
    //     require(_shareHolders.length == _shareStakes.length, ERROR_BAD_HOLDERS_STAKES_LEN);
    //     require(_boardMembers.length > 0, ERROR_MISSING_BOARD_MEMBERS);
    // }
}
