pragma solidity 0.4.24;

// import "@aragon/os/contracts/common/Uint256Helpers.sol";
// import "@aragon/os/contracts/factory/DAOFactory.sol";
// import "@aragon/os/contracts/kernel/Kernel.sol";
// import "@aragon/os/contracts/acl/ACL.sol";
// import "@aragon/os/contracts/apm/APMNamehash.sol";
// import "@aragon/os/contracts/common/IsContract.sol";
// import "@aragon/id/contracts/IFIFSResolvingRegistrar.sol";
// import "@aragon/kits-base/contracts/KitBase.sol";
// import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
// import "@aragon/apps-voting/contracts/Voting.sol";
// import "@aragon/apps-vault/contracts/Vault.sol";
// import "@aragon/apps-token-manager/contracts/TokenManager.sol";
// import "@aragon/apps-finance/contracts/Finance.sol";
import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import "@ablack/fundraising-module-tap/contracts/Tap.sol";
import {AragonFundraisingController as Controller} from "@ablack/fundraising-controller-aragon-fundraising/contracts/AragonFundraisingController.sol";
import {BatchedBancorMarketMaker as MarketMaker} from "@ablack/fundraising-market-maker-bancor/contracts/BatchedBancorMarketMaker.sol";
// import "@ablack/fundraising-controller-aragon-fundraising/contracts/Controller.sol";
// import "@ablack/fundraising-market-maker-bancor/contracts/BatMarketMaker.sol";

import "@ablack/fundraising-formula-bancor/contracts/BancorFormula.sol";

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


    function prepareInstance(
        string _boardTokenName,
        string _boardTokenSymbol,
        address[] _boardMembers,
        uint64[3] _boardVotingSettings,
        uint64 _financePeriod
    )
        external
    {
        require(_boardVotingSettings.length == 3, ERROR_BAD_VOTE_SETTINGS);


        (Kernel dao, ACL acl) = _createDAO();

        MiniMeToken boardToken = _createToken(_boardTokenName, _boardTokenSymbol, BOARD_TOKEN_DECIMALS);
        (TokenManager tm,,,) = _installBoardApps(dao, boardToken, _boardVotingSettings, _financePeriod);

        // TokenManager boardTokenManager = _installTokenManagerApp(dao, boardToken, BOARD_TRANSFERABLE, BOARD_MAX_PER_ACCOUNT);
        // Voting boardVoting = _installVotingApp(dao, boardToken, _boardVotingSettings);
        // Vault vault = _installVaultApp(dao);
        // Finance finance = _installFinanceApp(dao, vault, _financePeriod == 0 ? DEFAULT_FINANCE_PERIOD : _financePeriod);

        _mintTokens(acl, tm, _boardMembers, 1);
        _setupBoardPermissions();

        // // _createEvmScriptsRegistryPermissions(_acl, _voting, _voting);


        // _cachePreparedDao(dao, boardTokenManager, boardVoting, vault);
    }


    function finalizeInstance(string _shareTokenName, string _shareTokenSymbol, uint64[3] _shareVotingSettings) external {
    //     // _ensureFinalizationSettings(_shareHolders, _shareStakes, _boardMembers);

        Kernel dao = _popDaoCache();
        
        MiniMeToken shareToken = _createToken(_shareTokenName, _shareTokenSymbol, SHARE_TOKEN_DECIMALS);
        
        _installShareApps(dao, shareToken, _shareVotingSettings);
        _installFundraisingApps(dao);

        _setupSharePermissions(dao);
        _setupFundraisingPermissions(dao);


    //     // // _initializeReserve(reserve);

    //     // reserve.initialize();
    //     // marketMaker.initialize(controller, shareTokenManager, reserve, vault, IBancorFormula(_latestVersionAppBase("bancor-formula")), BATCH_BLOCKS, BUY_FEE, SELL_FEE);


    //     // _registerID(_id, address(dao));


    
    //     // (Kernel dao, Voting shareVoting, Voting boardVoting) = _popDaoCache();

    //     // _setupVaultAndFinanceApps(dao, _financePeriod, _useAgentAsVault, shareVoting, boardVoting);
    //     // _finalizeApps(dao, _shareHolders, _shareStakes, _boardMembers, shareVoting, boardVoting);

    //     // _transferRootPermissionsFromTemplate(dao, boardVoting, shareVoting);
    //     // _registerID(_id, address(dao));
    }

    function _installBoardApps(Kernel _dao, MiniMeToken _token, uint64[3] _votingSettings, uint64 _financePeriod)
        internal
        returns (TokenManager tm, Voting voting, Vault vault, Finance finance)
    {
        tm = _installTokenManagerApp(_dao, _token, BOARD_TRANSFERABLE, BOARD_MAX_PER_ACCOUNT);
        voting = _installVotingApp(_dao, _token, _votingSettings);
        vault = _installVaultApp(_dao);
        finance = _installFinanceApp(_dao, vault, _financePeriod == 0 ? DEFAULT_FINANCE_PERIOD : _financePeriod);

        _cacheBoardDao(_dao, tm, voting, vault, finance);
    }

    function _installShareApps(Kernel _dao, MiniMeToken _shareToken, uint64[3] _shareVotingSettings) internal returns (TokenManager tm, Voting voting) {
        tm = _installTokenManagerApp(_dao, _shareToken, SHARE_TRANSFERABLE, SHARE_MAX_PER_ACCOUNT);
        voting = _installVotingApp(_dao, _shareToken, _shareVotingSettings);

        _cacheShareApps(tm, voting);
    }

    function _installFundraisingApps(Kernel _dao) internal returns (Pool reserve, MarketMaker marketMaker, Tap tap, Controller controller) {
        bytes32[4] memory apps = [
            apmNamehash("pool"),   // 0
            // apmNamehash("bancor-formula"), //4
            apmNamehash("batched-bancor-market-maker"), // 3
            apmNamehash("tap"),    // 1
            apmNamehash("aragon-fundraising")        // 2
        ];

        (, TokenManager boardTM, Voting boardVoting, Vault beneficiary,) = _popBoardDaoCache();
        (TokenManager shareTM, Voting shareVoting) = _popShareAppsCache();

        reserve = Pool(_registerApp(_dao, apps[0]));
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

    function _setupBoardPermissions() internal {
        (Kernel dao, TokenManager tm, Voting voting, Vault vault, Finance finance) = _popBoardDaoCache();

        ACL acl = ACL(dao.acl());

        _createTokenManagerPermissions(acl, tm, voting, voting);
        _createVotingPermissions(acl, voting, voting, tm, voting);
        _createVaultPermissions(acl, vault, finance, voting);
        _createFinancePermissions(acl, finance, voting, voting);
    }

    function _setupSharePermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (,TokenManager boardTM,,,) = _popBoardDaoCache();
        (TokenManager shareTM, Voting shareVoting) = _popShareAppsCache();
        (, MarketMaker marketMaker,,) = _popFundraisingAppsCache();

        _createTokenManagerPermissions(acl, shareTM, marketMaker, shareVoting);
        _createVotingPermissions(acl, shareVoting, shareVoting, boardTM, shareVoting);
    }

    function _setupFundraisingPermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (,, Voting _boardVoting,,) = _popBoardDaoCache();
        (, Voting _shareVoting) = _popShareAppsCache();
        (Pool _reserve, MarketMaker _marketMaker, Tap _tap, Controller _controller) = _popFundraisingAppsCache();

        _createReservePermissions(acl, _reserve, _marketMaker, _tap, _controller, _shareVoting);
        _createMarketMakerPermissions (acl, _marketMaker, _controller, _shareVoting);
        _createTapPermissions(acl, _tap, _controller, _boardVoting, _shareVoting);
        _createControllerPermissions(acl, _controller, _boardVoting, _shareVoting);
    
    }

    function _createReservePermissions(
        ACL _acl,
        Pool _reserve,
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
        _acl.createPermission(_board, _controller, _controller.UPDATE_BENEFICIARY_ROLE(), _board);
        _acl.createPermission(_board, _controller, _controller.WITHDRAW_ROLE(), _board);
        _acl.createPermission(_share, _controller, _controller.UPDATE_FEES_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.ADD_COLLATERAL_TOKEN_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.REMOVE_COLLATERAL_TOKEN_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.UPDATE_COLLATERAL_TOKEN_ROLE(), _share);
        _acl.createPermission(_share, _controller, _controller.UPDATE_TOKEN_TAP_ROLE(), _share);
        _acl.createPermission(address(-1), _controller, _controller.OPEN_BUY_ORDER_ROLE(), _share);
        _acl.createPermission(address(-1), _controller, _controller.OPEN_SELL_ORDER_ROLE(), _share);
    }



    function _cacheBoardDao(Kernel _dao, TokenManager _tm, Voting _voting, Vault _vault, Finance _finance) internal {
        Cache storage c = cache[msg.sender];

        c.dao = address(_dao);
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

    function _cacheFundraisingApps(Pool _reserve, MarketMaker _marketMaker, Tap _tap, Controller _controller) internal {
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

   

    function _popBoardDaoCache() internal returns (
        Kernel dao,
        TokenManager boardTokenManager,
        Voting boardVoting,
        Vault vault,
        Finance finance
    ) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        dao = Kernel(c.dao);
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

    function _popFundraisingAppsCache() internal returns (Pool reserve, MarketMaker marketMaker, Tap tap, Controller controller) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        reserve = Pool(c.reserve);
        marketMaker = MarketMaker(c.marketMaker);
        tap = Tap(c.tap);
        controller = Controller(c.controller);


        // delete c.dao;
        // delete c.boardTokenManager;
        // delete c.boardVoting;
        // delete c.vault;
    }


     // function _popCompleteCache() internal returns (
    //     Kernel dao,
    //     TokenManager boardTokenManager,
    //     Voting boardVoting,
    //     Vault vault,
    //     Finance finance,
    //     TokenManager shareTokenManager,
    //     Voting shareVoting,
    //     Pool reserve,
    //     MarketMaker marketMaker,
    //     Tap tap,
    //     Controller controller
    // ) {
    //     Cache storage c = cache[msg.sender];
    //     require(c.dao != address(0), ERROR_MISSING_CACHE);

    //     dao = Kernel(c.dao);
    //     boardTokenManager = TokenManager(c.boardTokenManager);
    //     boardVoting = Voting(c.boardVoting);
    //     vault = Vault(c.vault);
    //     finance = Finance(c.finance);
    //     shareTokenManager = TokenManager(c.shareTokenManager);
    //     shareVoting = Voting(c.shareVoting);
    //     reserve = Pool(c.reserve);
    //     marketMaker = MarketMaker(c.marketMaker);
    //     tap = Tap(c.tap);
    //     controller = Controller(c.controller);


    //     // delete c.dao;
    //     // delete c.boardTokenManager;
    //     // delete c.boardVoting;
    //     // delete c.vault;
    // }

    // function _popAndClearDaoCache() internal returns (Kernel dao, TokenManager boardTokenManager, Voting boardVoting, Vault vault) {
    //     Cache storage c = cache[msg.sender];
    //     require(c.dao != address(0), ERROR_MISSING_CACHE);

    //     dao = Kernel(c.dao);
    //     boardTokenManager = TokenManager(c.boardTokenManager);
    //     boardVoting = Voting(c.boardVoting);
    //     vault = Vault(c.vault);
    //     // finance = Finance(c.finance);
    //     // shareTokenManager = TokenManager(c.shareTokenManager);
    //     // shareVoting = Voting(c.shareVoting);
    //     // reserve = Pool(c.reserve);
    //     // marketMaker = MarketMaker(c.marketMaker);
    //     // tap = Tap(c.tap);
    //     // controller = Controller(c.controller);

    //     delete c.dao;
    //     delete c.boardTokenManager;
    //     delete c.boardVoting;
    //     delete c.vault;
    // }

    // function _popTokenCaches() internal returns (MiniMeToken shareToken, MiniMeToken boardToken) {
    //     Cache storage c = cache[msg.sender];
    //     require(c.shareToken != address(0) && c.boardToken != address(0), ERROR_MISSING_CACHE);

    //     shareToken = MiniMeToken(c.shareToken);
    //     boardToken = MiniMeToken(c.boardToken);
    //     delete c.shareToken;
    //     delete c.boardToken;
    // }

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
