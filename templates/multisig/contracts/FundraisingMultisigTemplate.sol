pragma solidity 0.4.24;

import "@aragon/apps-agent/contracts/Agent.sol";
import "@aragon/templates-shared/contracts/BaseTemplate.sol";
import "@ablack/fundraising-bancor-formula/contracts/BancorFormula.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";
import {AragonFundraisingController as Controller} from "@ablack/fundraising-aragon-fundraising/contracts/AragonFundraisingController.sol";
import {BatchedBancorMarketMaker as MarketMaker} from "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";
import "@ablack/fundraising-presale/contracts/Presale.sol";
import "@aragon/os/contracts/lib/token/ERC20.sol";


contract FundraisingMultisigTemplate is BaseTemplate {
    // string private constant ERROR_EMPTY_ID = "FM_EMPTY_ID";
    // string private constant ERROR_EMPTY_BOARD = "FM_EMPTY_BOARD";
    string private constant ERROR_BAD_SETTINGS        = "FM_BAD_SETTINGS";
    // string private constant ERROR_BAD_FUNDRAISING_SETTINGS = "FM_BAD_FUNDRAISING_SETTINGS";
    // string private constant ERROR_BAD_COLLATERALS_SETTINGS = "FM_BAD_COLLATERALS_SETTINGS";
    string private constant ERROR_MISSING_CACHE = "FM_MISSING_CACHE";

    bool    constant private BOARD_TRANSFERABLE     = false;
    uint8   constant private BOARD_TOKEN_DECIMALS   = uint8(0);
    uint256 constant private BOARD_MAX_PER_ACCOUNT  = uint256(1);

    bool    constant private SHARE_TRANSFERABLE     = true;
    uint8   constant private SHARE_TOKEN_DECIMALS   = uint8(18);
    uint256 constant private SHARE_MAX_PER_ACCOUNT  = uint256(0);

    uint64 constant private  DEFAULT_FINANCE_PERIOD = uint64(30 days);

    uint256 private constant PPM   = 1000000; // 0% = 0; 1% = 10 ** 4; 100% = 10 ** 6
    uint256 private constant BUY_FEE      = 0;
    uint256 private constant SELL_FEE     = 0;

    uint32 constant private DAI_RESERVE_RATIO = 100000; // 10%
    uint32 constant private ANT_RESERVE_RATIO = 10000;  // 1%

    bytes32 constant private BANCOR_FORMULA_ID     = apmNamehash("bancor-formula");
    bytes32 constant private PRESALE_ID            = apmNamehash("presale");
    bytes32 constant private MARKET_MAKER_ID       = apmNamehash("batched-bancor-market-maker");
    bytes32 constant private TAP_ID                = apmNamehash("tap");
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
        address presale;
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

    /***** external functions *****/

    function prepareInstance(
        string    _boardTokenName,
        string    _boardTokenSymbol,
        address[] _boardMembers,
        uint64[3] _boardVotingSettings,
        uint64    _financePeriod
    )
        external
    {
        require(_boardMembers.length > 0,         ERROR_BAD_SETTINGS);
        require(_boardVotingSettings.length == 3, ERROR_BAD_SETTINGS);

        // deploy DAO
        (Kernel dao, ACL acl) = _createDAO();
        // deploy board token
        MiniMeToken boardToken = _createToken(_boardTokenName, _boardTokenSymbol, BOARD_TOKEN_DECIMALS);
        // install board apps
        TokenManager tm = _installBoardApps(dao, boardToken, _boardVotingSettings, _financePeriod);
        // mint board tokens
        _mintTokens(acl, tm, _boardMembers, 1);
        // cache DAO
        _cacheDao(dao);

    }

    function installShareApps(
        string    _id,
        string    _shareTokenName,
        string    _shareTokenSymbol,
        uint64[3] _shareVotingSettings
    )
        external
    {
        require(bytes(_id).length > 0,            ERROR_BAD_SETTINGS);
        require(_shareVotingSettings.length == 3, ERROR_BAD_SETTINGS);
        _ensureBoardAppsCache();

        Kernel dao = _popDaoCache();
        // deploy share token
        MiniMeToken shareToken = _createToken(_shareTokenName, _shareTokenSymbol, SHARE_TOKEN_DECIMALS);
        // install share apps
        _installShareApps(dao, shareToken, _shareVotingSettings);
        // setup board apps permissions [now that share apps have been installed]
        _setupBoardPermissions(dao);
        // register id
        _registerID(_id, address(dao));
    }

    function installFundraisingApps(
        uint256    _presaleGoal,
        uint64     _presalePeriod,
        uint64     _vestingCliffPeriod,
        uint64     _vestingCompletePeriod,
        uint256    _percentSupplyOffered,
        uint256    _percentFundingForBeneficiary,
        uint64     _startDate,
        uint256    _batchBlocks,
        uint256    _maxTapRateIncreasePct,
        uint256    _maxTapFloorDecreasePct,
        address[2] _collaterals
    )
        external
    {
        require(_collaterals.length == 2, ERROR_BAD_SETTINGS);
        // _ensureFundraisingSettings(
        //     _presaleGoal,
        //     _presalePeriod,
        //     _vestingCliffPeriod,
        //     _vestingCompletePeriod,
        //     _percentSupplyOffered,
        //     _percentFundingForBeneficiary,
        //     _batchBlocks,
        //     _collaterals
        // );
        _ensureShareAppsCache();

        Kernel dao = _popDaoCache();
        // install fundraising apps
        _installFundraisingApps(
            dao,
            _presaleGoal,
            _presalePeriod,
            _vestingCliffPeriod,
            _vestingCompletePeriod,
            _percentSupplyOffered,
            _percentFundingForBeneficiary,
            _startDate,
            _batchBlocks,
            _maxTapRateIncreasePct,
            _maxTapFloorDecreasePct,
            _collaterals
        );
        // setup share apps permissions [now that fundraising apps have been installed]
        _setupSharePermissions(dao);
        // setup fundraising apps permissions
        _setupFundraisingPermissions(dao);
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
        require(_collaterals.length == 2,     ERROR_BAD_SETTINGS);
        require(_virtualSupplies.length == 2, ERROR_BAD_SETTINGS);
        require(_virtualBalances.length == 2, ERROR_BAD_SETTINGS);
        require(_slippages.length == 2,       ERROR_BAD_SETTINGS);
        require(_taps.length == 2,            ERROR_BAD_SETTINGS);
        require(_floors.length == 2,          ERROR_BAD_SETTINGS);
        _ensureFundraisingAppsCache();

        Kernel dao = _popDaoCache();
        ACL acl = ACL(dao.acl());
        (, Voting shareVoting) = _popShareAppsCache();

        // setup collaterals
        _setupCollaterals(dao, _collaterals, _virtualSupplies, _virtualBalances, _slippages, _taps, _floors);
        // setup controller app permissions [now that collaterals have been setup]
        // _setupControllerPermissions(dao);
        // setup EVM script registry permissions
        _createEvmScriptsRegistryPermissions(acl, shareVoting, shareVoting);
        // clear DAO permissions
        _transferRootPermissionsFromTemplateAndFinalizeDAO(dao, shareVoting, shareVoting);
        // clear cache
        _clearCache();
    }

    /***** internal apps installation functions *****/

    function _installBoardApps(Kernel _dao, MiniMeToken _token, uint64[3] _votingSettings, uint64 _financePeriod)
        internal
        returns (TokenManager)
    {
        TokenManager tm = _installTokenManagerApp(_dao, _token, BOARD_TRANSFERABLE, BOARD_MAX_PER_ACCOUNT);
        Voting voting = _installVotingApp(_dao, _token, _votingSettings);
        Vault vault = _installVaultApp(_dao);
        Finance finance = _installFinanceApp(_dao, vault, _financePeriod == 0 ? DEFAULT_FINANCE_PERIOD : _financePeriod);

        _cacheBoardApps(tm, voting, vault, finance);

        return tm;
    }

    function _installShareApps(Kernel _dao, MiniMeToken _shareToken, uint64[3] _shareVotingSettings)
        internal
    {
        TokenManager tm = _installTokenManagerApp(_dao, _shareToken, SHARE_TRANSFERABLE, SHARE_MAX_PER_ACCOUNT);
        Voting voting = _installVotingApp(_dao, _shareToken, _shareVotingSettings);

        _cacheShareApps(tm, voting);
    }

    function _installFundraisingApps(
        Kernel     _dao,
        uint256    _presaleGoal,
        uint64     _presalePeriod,
        uint64     _vestingCliffPeriod,
        uint64     _vestingCompletePeriod,
        uint256    _percentSupplyOffered,
        uint256    _percentFundingForBeneficiary,
        uint64     _startDate,
        uint256    _batchBlocks,
        uint256    _maxTapRateIncreasePct,
        uint256    _maxTapFloorDecreasePct,
        address[2] _collaterals
    )
        internal
    {
        address[] memory collaterals = new address[](2);
        collaterals[0] = _collaterals[0];
        collaterals[1] = _collaterals[1];

        _proxifyFundraisingApps(_dao);

        _initializePresale(
            _presaleGoal,
            _presalePeriod,
            _vestingCliffPeriod,
            _vestingCompletePeriod,
            _percentSupplyOffered,
            _percentFundingForBeneficiary,
            _startDate,
            collaterals
        );
        _initializeMarketMaker(_batchBlocks);
        _initializeTap(_batchBlocks, _maxTapRateIncreasePct, _maxTapFloorDecreasePct);
        _initializeController();
    }

    function _proxifyFundraisingApps(Kernel _dao) internal {
        Agent reserve = _installNonDefaultAgentApp(_dao);
        Presale presale = Presale(_registerApp(_dao, PRESALE_ID));
        MarketMaker marketMaker = MarketMaker(_registerApp(_dao, MARKET_MAKER_ID));
        Tap tap = Tap(_registerApp(_dao, TAP_ID));
        Controller controller = Controller(_registerApp(_dao, ARAGON_FUNDRAISING_ID));

        _cacheFundraisingApps(reserve, presale, marketMaker, tap, controller);
    }

    /***** internal apps initialization functions *****/

    function _initializePresale(
        uint256   _presaleGoal,
        uint64    _presalePeriod,
        uint64    _vestingCliffPeriod,
        uint64    _vestingCompletePeriod,
        uint256   _percentSupplyOffered,
        uint256   _percentFundingForBeneficiary,
        uint64    _startDate,
        address[] _collaterals
    )
        internal
    {
        _presaleCache().initialize(
            _controllerCache(),
            _shareTMCache(),
            _reserveCache(),
            _vaultCache(),
            ERC20(_collaterals[0]),
            DAI_RESERVE_RATIO,
            _presaleGoal,
            _presalePeriod,
            _vestingCliffPeriod,
            _vestingCompletePeriod,
            _percentSupplyOffered,
            _percentFundingForBeneficiary,
            _startDate,
            _collaterals
        );
    }

    function _initializeMarketMaker(uint256 _batchBlocks) internal {
        IBancorFormula bancorFormula = IBancorFormula(_latestVersionAppBase(BANCOR_FORMULA_ID));

        (,, Vault beneficiary,) = _popBoardAppsCache();
        (TokenManager shareTM,) = _popShareAppsCache();
        (Agent reserve,, MarketMaker marketMaker,, Controller controller) = _popFundraisingAppsCache();

        // Agent reserve = _reserveCache();
        // MarketMaker marketMaker = _marketMakerCache();
        // Controller controller = _controllerCache();


        marketMaker.initialize(controller, shareTM, bancorFormula, reserve, beneficiary, _batchBlocks, BUY_FEE, SELL_FEE);
    }

    function _initializeTap(uint256 _batchBlocks, uint256 _maxTapRateIncreasePct, uint256 _maxTapFloorDecreasePct) internal {
        (,, Vault beneficiary,) = _popBoardAppsCache();

        (Agent reserve,,, Tap tap, Controller controller) = _popFundraisingAppsCache();
        // Agent reserve = _reserveCache();
        // Tap tap = _tapCache();
        // Controller controller = _controllerCache();

        tap.initialize(controller, reserve, beneficiary, _batchBlocks, _maxTapRateIncreasePct, _maxTapFloorDecreasePct);
    }

    function _initializeController() internal {
        // Agent reserve = _reserveCache();
        // Presale presale = _presaleCache();
        // MarketMaker marketMaker = _marketMakerCache();
        // Tap tap = _tapCache();
        // Controller controller = _controllerCache();

        (Agent reserve, Presale presale, MarketMaker marketMaker, Tap tap, Controller controller) = _popFundraisingAppsCache();

        controller.initialize(presale, marketMaker, reserve, tap);
    }

    /***** internal setup functions *****/

    function _setupCollaterals(
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
        (,,,, Controller c) = _popFundraisingAppsCache();
        (, Voting shareVoting) = _popShareAppsCache();
        // Controller c = _controllerCache();

        // create and grant ADD_COLLATERAL_TOKEN_ROLE to template
        acl.createPermission(this, c, c.ADD_COLLATERAL_TOKEN_ROLE(), this);
        // add collaterals
        c.addCollateralToken(_collaterals[0], _virtualSupplies[0], _virtualBalances[0], DAI_RESERVE_RATIO, _slippages[0], _taps[0], _floors[0]);
        c.addCollateralToken(_collaterals[1], _virtualSupplies[1], _virtualBalances[1], ANT_RESERVE_RATIO, _slippages[1], _taps[1], _floors[1]);
        // transfer ADD_COLLATERAL_TOKEN_ROLE to shareVoting
        _transferPermissionFromTemplate(acl, c, shareVoting, c.ADD_COLLATERAL_TOKEN_ROLE(), shareVoting);
    }

    /***** internal permissions functions *****/

    function _setupBoardPermissions(Kernel _dao) internal {
        (TokenManager boardTM, Voting boardVoting, Vault vault, Finance finance) = _popBoardAppsCache();
        (, Voting shareVoting) = _popShareAppsCache();

        ACL acl = ACL(_dao.acl());

        // TokenManager
        _createTokenManagerPermissions(acl, boardTM, boardVoting, shareVoting);
        // Voting
        _createVotingPermissions(acl, boardVoting, boardVoting, boardTM, shareVoting);
        // Vault
        _createVaultPermissions(acl, vault, finance, shareVoting);
        // acl.createPermission(finance, vault, vault.TRANSFER_ROLE(), shareVoting);
        // Finance
        _createFinancePermissions(acl, finance, boardVoting, shareVoting);
        _createFinanceCreatePaymentsPermission(acl, finance, boardVoting, shareVoting);
        // acl.createPermission(boardVoting, finance, finance.EXECUTE_PAYMENTS_ROLE(), shareVoting);
        // acl.createPermission(boardVoting, finance, finance.MANAGE_PAYMENTS_ROLE(), shareVoting);
        // acl.createPermission(boardVoting, finance, finance.CREATE_PAYMENTS_ROLE(), shareVoting);
    }

    function _setupSharePermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (TokenManager boardTM,,,) = _popBoardAppsCache();
        (TokenManager shareTM, Voting shareVoting) = _popShareAppsCache();
        (, Presale presale, MarketMaker marketMaker,,) = _popFundraisingAppsCache();
        // Presale presale = _presaleCache();
        // MarketMaker marketMaker = _marketMakerCache();

        // TokenManager
        address[] memory grantees = new address[](2);
        grantees[0] = address(marketMaker);
        grantees[1] = address(presale);
        acl.createPermission(marketMaker, shareTM, shareTM.MINT_ROLE(),shareVoting);
        acl.createPermission(presale, shareTM, shareTM.ISSUE_ROLE(),shareVoting);
        acl.createPermission(presale, shareTM, shareTM.ASSIGN_ROLE(),shareVoting);
        acl.createPermission(presale, shareTM, shareTM.REVOKE_VESTINGS_ROLE(), shareVoting);
        _createPermissions(acl, grantees, shareTM, shareTM.BURN_ROLE(), shareVoting);
        // Voting
        _createVotingPermissions(acl, shareVoting, shareVoting, boardTM, shareVoting);
    }

    function _setupFundraisingPermissions(Kernel _dao) internal {
        ACL acl = ACL(_dao.acl());

        (, Voting _boardVoting,,) = _popBoardAppsCache();
        (, Voting _shareVoting) = _popShareAppsCache();
        (Agent _reserve, Presale _presale, MarketMaker _marketMaker, Tap _tap, Controller _controller) = _popFundraisingAppsCache();

        // Agent _reserve = _reserveCache();
        // Presale _presale = _presaleCache();
        // MarketMaker _marketMaker = _marketMakerCache();
        // Tap _tap = _tapCache();
        // Controller _controller = _controllerCache();

        // reserve permissions
        address[] memory grantees = new address[](2);
        grantees[0] = address(_tap);
        grantees[1] = address(_marketMaker);
        acl.createPermission(_shareVoting, _reserve, _reserve.SAFE_EXECUTE_ROLE(), _shareVoting);
        acl.createPermission(_controller, _reserve, _reserve.ADD_PROTECTED_TOKEN_ROLE(), _shareVoting);
        _createPermissions(acl, grantees, _reserve, _reserve.TRANSFER_ROLE(), _shareVoting);
        // presale
        acl.createPermission(_controller, _presale, _presale.OPEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _presale, _presale.CONTRIBUTE_ROLE(), _shareVoting);
        // market maker
        acl.createPermission(_controller, _marketMaker, _marketMaker.OPEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.UPDATE_BENEFICIARY_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.UPDATE_FEES_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.ADD_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.REMOVE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.OPEN_BUY_ORDER_ROLE(), _shareVoting);
        acl.createPermission(_controller, _marketMaker, _marketMaker.OPEN_SELL_ORDER_ROLE(), _shareVoting);
        // tap
        acl.createPermission(_controller, _tap, _tap.UPDATE_BENEFICIARY_ROLE(), _shareVoting);
        acl.createPermission(_controller, _tap, _tap.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE(), _shareVoting);
        acl.createPermission(_controller, _tap, _tap.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE(), _shareVoting);
        acl.createPermission(_controller, _tap, _tap.ADD_TAPPED_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _tap, _tap.UPDATE_TAPPED_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _tap, _tap.RESET_TAPPED_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_controller, _tap, _tap.WITHDRAW_ROLE(), _shareVoting);
        // controller
        // ADD_COLLATERAL_TOKEN_ROLE is handled later [after collaterals have been added]
        acl.createPermission(_shareVoting, _controller, _controller.UPDATE_BENEFICIARY_ROLE(), _shareVoting);
        acl.createPermission(_shareVoting, _controller, _controller.UPDATE_FEES_ROLE(), _shareVoting);
        acl.createPermission(_shareVoting, _controller, _controller.REMOVE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_shareVoting, _controller, _controller.UPDATE_COLLATERAL_TOKEN_ROLE(), _shareVoting);
        acl.createPermission(_shareVoting, _controller, _controller.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE(), _shareVoting);
        acl.createPermission(_shareVoting, _controller, _controller.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE(), _shareVoting);
        acl.createPermission(_shareVoting, _controller, _controller.UPDATE_TOKEN_TAP_ROLE(), _shareVoting);
        acl.createPermission(_presale, _controller, _controller.RESET_TOKEN_TAP_ROLE(), _shareVoting);
        acl.createPermission(_boardVoting, _controller, _controller.OPEN_PRESALE_ROLE(), _shareVoting);
        acl.createPermission(_presale, _controller, _controller.OPEN_TRADING_ROLE(), _shareVoting);
        acl.createPermission(address(-1), _controller, _controller.CONTRIBUTE_ROLE(), _shareVoting);
        acl.createPermission(address(-1), _controller, _controller.OPEN_BUY_ORDER_ROLE(), _shareVoting);
        acl.createPermission(address(-1), _controller, _controller.OPEN_SELL_ORDER_ROLE(), _shareVoting);
        acl.createPermission(address(-1), _controller, _controller.WITHDRAW_ROLE(), _shareVoting);
    }

    /***** internal cache functions *****/

    function _cacheDao(Kernel _dao) internal {
        Cache storage c = cache[msg.sender];

        c.dao = address(_dao);
    }

    function _cacheBoardApps(TokenManager _tm, Voting _voting, Vault _vault, Finance _finance) internal {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        c.boardTokenManager = address(_tm);
        c.boardVoting = address(_voting);
        c.vault = address(_vault);
        c.finance = address(_finance);
    }

    function _cacheShareApps(TokenManager _tm, Voting _voting) internal {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        c.shareTokenManager = address(_tm);
        c.shareVoting = address(_voting);
    }

    function _cacheFundraisingApps(Agent _reserve, Presale _presale, MarketMaker _marketMaker, Tap _tap, Controller _controller) internal {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        c.reserve = address(_reserve);
        c.presale = address(_presale);
        c.marketMaker = address(_marketMaker);
        c.tap = address(_tap);
        c.controller = address(_controller);
    }

    function _popDaoCache() internal returns (Kernel dao) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

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
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        tm = TokenManager(c.boardTokenManager);
        voting = Voting(c.boardVoting);
        vault = Vault(c.vault);
        finance = Finance(c.finance);
    }

    function _popShareAppsCache() internal returns (TokenManager tm, Voting voting) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        tm = TokenManager(c.shareTokenManager);
        voting = Voting(c.shareVoting);
    }

    function _shareTMCache() internal returns (TokenManager shareTM) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        shareTM = TokenManager(c.shareTokenManager);
    }

    function _vaultCache() internal returns (Vault vault) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        vault = Vault(c.vault);
    }

    function _reserveCache() internal returns (Agent reserve) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        reserve = Agent(c.reserve);
    }

    function _presaleCache() internal returns (Presale presale) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        presale = Presale(c.presale);
    }

    // function _marketMakerCache() internal returns (MarketMaker marketMaker) {
    //     Cache storage c = cache[msg.sender];
    //     // require(c.dao != address(0), ERROR_MISSING_CACHE);

    //     marketMaker = MarketMaker(c.marketMaker);
    // }

    // function _tapCache() internal returns (Tap tap) {
    //     Cache storage c = cache[msg.sender];
    //     // require(c.dao != address(0), ERROR_MISSING_CACHE);

    //     tap = Tap(c.tap);
    // }

    function _controllerCache() internal returns (Controller controller) {
        Cache storage c = cache[msg.sender];
        // require(c.dao != address(0), ERROR_MISSING_CACHE);

        controller = Controller(c.controller);
    }

    function _popFundraisingAppsCache() internal returns (Agent reserve, Presale presale, MarketMaker marketMaker, Tap tap, Controller controller) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0), ERROR_MISSING_CACHE);

        reserve = Agent(c.reserve);
        presale = Presale(c.presale);
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
        delete c.presale;
        delete c.marketMaker;
        delete c.tap;
        delete c.controller;
    }

    /***** internal check functions *****/

    function _ensureBoardAppsCache() internal {
        Cache storage c = cache[msg.sender];
        require(
            c.boardTokenManager != address(0) &&
            c.boardVoting != address(0) &&
            c.vault != address(0) &&
            c.finance != address(0),
            ERROR_MISSING_CACHE
        );
    }

    function _ensureShareAppsCache() internal {
        Cache storage c = cache[msg.sender];
        require(
            c.shareTokenManager != address(0) &&
            c.shareVoting != address(0),
            ERROR_MISSING_CACHE
        );
    }

    function _ensureFundraisingAppsCache() internal {
        Cache storage c = cache[msg.sender];
        require(
            c.reserve != address(0) &&
            c.presale != address(0) &&
            c.marketMaker != address(0) &&
            c.controller != address(0),
            ERROR_MISSING_CACHE
        );
    }

    /***** utils functions *****/

    function _registerApp(Kernel _dao, bytes32 _appId) internal returns (address) {
        address proxy = _dao.newAppInstance(_appId, _latestVersionAppBase(_appId));
        emit InstalledApp(proxy, _appId);

        return proxy;
    }

//     function _createDAO() internal returns (Kernel dao, ACL acl) {
//         (dao, acl) = super._createDAO();

//         _cacheDao(dao);
//     }
}
