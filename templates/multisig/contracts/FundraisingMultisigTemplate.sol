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
import "@ablack/fundraising-controller-aragon-fundraising/contracts/AragonFundraisingController.sol";
import "@ablack/fundraising-market-maker-bancor/contracts/BatchedBancorMarketMaker.sol";
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

    uint64 constant private DEFAULT_FINANCE_PERIOD = uint64(30 days);

    uint256 constant BATCH_BLOCKS = uint256(1);
    uint256 constant BUY_FEE = uint256(0);
    uint256 constant SELL_FEE = uint256(0);

    struct Cache {
        address dao;
        address boardTokenManager;
        address boardVoting;
        address vault;
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

        MiniMeToken boardToken = _createToken(_boardTokenName, _boardTokenSymbol, BOARD_TOKEN_DECIMALS);

        (Kernel dao, ACL acl) = _createDAO();

        TokenManager boardTokenManager = _installTokenManagerApp(dao, boardToken, BOARD_TRANSFERABLE, BOARD_MAX_PER_ACCOUNT);
        Voting boardVoting = _installVotingApp(dao, boardToken, _boardVotingSettings);
        Vault vault = _installVaultApp(dao);
        Finance finance = _installFinanceApp(dao, vault, _financePeriod == 0 ? DEFAULT_FINANCE_PERIOD : _financePeriod);

        _mintTokens(acl, boardTokenManager, _boardMembers, 1);

        _cachePreparedDao(dao, boardTokenManager, boardVoting, vault);
    }


    function finalizeInstance(
        string _id,
        string _shareTokenName,
        string _shareTokenSymbol,
        uint64[3] _shareVotingSettings
        // address[] _shareHolders,
        // uint256[] _shareStakes,
        // address[] _boardMembers,
        // uint64 _financePeriod,
        // bool _useAgentAsVault
    )
        external
    {
        // _ensureFinalizationSettings(_shareHolders, _shareStakes, _boardMembers);

        

        MiniMeToken shareToken = _createToken(_shareTokenName, _shareTokenSymbol, SHARE_TOKEN_DECIMALS);

        (Kernel dao, TokenManager boardTokenManager, Voting boardVoting, Vault vault) = _popDaoCache();

        TokenManager shareTokenManager = _installTokenManagerApp(dao, shareToken, SHARE_TRANSFERABLE, SHARE_MAX_PER_ACCOUNT);
        Voting shareVoting = _installVotingApp(dao, shareToken, _shareVotingSettings);

        
        // (Pool reserve, BatchedBancorMarketMaker marketMaker, Tap tap, AragonFundraisingController controller) = _registerFundraisingApps(dao);

        // bytes32[4] memory apps = [
        //     apmNamehash("pool"),   // 0
        //     // apmNamehash("bancor-formula"), //4
        //     apmNamehash("batched-bancor-market-maker"), // 3
        //     apmNamehash("tap"),    // 1
        //     apmNamehash("aragon-fundraising")        // 2
        // ];

        // Pool reserve = Pool(_registerApp(dao, apps[0]));
        // BatchedBancorMarketMaker marketMaker = BatchedBancorMarketMaker(_registerApp(dao, apps[1]));
        // Tap tap = Tap(_registerApp(dao, apps[2]));
        // AragonFundraisingController controller = AragonFundraisingController(_registerApp(dao, apps[3]));

        _installFundraisingApps(dao, shareTokenManager, vault);

        // // _initializeReserve(reserve);

        // reserve.initialize();
        // marketMaker.initialize(controller, shareTokenManager, reserve, vault, IBancorFormula(_latestVersionAppBase("bancor-formula")), BATCH_BLOCKS, BUY_FEE, SELL_FEE);



        // (Kernel dao, Voting shareVoting, Voting boardVoting) = _popDaoCache();

        // _setupVaultAndFinanceApps(dao, _financePeriod, _useAgentAsVault, shareVoting, boardVoting);
        // _finalizeApps(dao, _shareHolders, _shareStakes, _boardMembers, shareVoting, boardVoting);

        // _transferRootPermissionsFromTemplate(dao, boardVoting, shareVoting);
        _registerID(_id, address(dao));
    }

    function _installFundraisingApps(Kernel _dao, TokenManager _shareTokenManager, Vault _beneficiary) internal returns (Pool reserve, BatchedBancorMarketMaker marketMaker, Tap tap, AragonFundraisingController controller) {
        bytes32[4] memory apps = [
            apmNamehash("pool"),   // 0
            // apmNamehash("bancor-formula"), //4
            apmNamehash("batched-bancor-market-maker"), // 3
            apmNamehash("tap"),    // 1
            apmNamehash("aragon-fundraising")        // 2
        ];

        reserve = Pool(_registerApp(_dao, apps[0]));
        marketMaker = BatchedBancorMarketMaker(_registerApp(_dao, apps[1]));
        tap = Tap(_registerApp(_dao, apps[2]));
        controller = AragonFundraisingController(_registerApp(_dao, apps[3]));


        reserve.initialize();
        marketMaker.initialize(controller, _shareTokenManager, reserve, _beneficiary, IBancorFormula(_latestVersionAppBase(apmNamehash("bancor-formula"))), BATCH_BLOCKS, BUY_FEE, SELL_FEE);
        tap.initialize(controller, reserve, _beneficiary, BATCH_BLOCKS, uint256(50 * 10 ** 16));
        controller.initialize(marketMaker, reserve, tap);
    }

    function _registerApp(Kernel _dao, bytes32 _appId) internal returns (address) {
        address proxy = _dao.newAppInstance(_appId, _latestVersionAppBase(_appId));
        emit InstalledApp(proxy, _appId);

        return proxy;
    }

    // function _initializeReserve(Pool _reserve) internal {
    //     _reserve.initialize();
    // }

    // function _initializeMarketMaker(BatchedBancorMarketMaker _marketMaker, AragonFundraisingController _controller, TokenManager _shareTokenManager,  Vault _reserve, Vault _beneficiary) internal {
    //     _marketMaker.initialize(_controller, _shareTokenManager, _reserve, _beneficiary, IBancorFormula(_latestVersionAppBase("bancor-formula")), BATCH_BLOCKS, BUY_FEE, SELL_FEE);
    // }

    //  pool.initialize();
    //     tap.initialize(controller, Vault(pool), address(vault), 1, uint256(50 * 10 ** 16));
    //     marketMaker.initialize(
    //       controller,
    //       tokenManager,
    //       Vault(pool),
    //       address(vault),
    //       BancorFormula(latestVersionAppBase(apps[4])),
    //       uint256(1),
    //       uint256(0),
    //       uint256(0)
    //     );
    //     controller.initialize(marketMaker, pool, tap);

    // function _setupPermissions(
    //     ACL _acl,
    //     Vault _agentOrVault,
    //     Voting _voting,
    //     Finance _finance,
    //     TokenManager _tokenManager,
    //     bool _useAgentAsVault
    // )
    //     internal
    // {
    //     if (_useAgentAsVault) {
    //         _createAgentPermissions(_acl, Agent(_agentOrVault), _voting, _voting);
    //     }
    //     _createVaultPermissions(_acl, _agentOrVault, _finance, _voting);
    //     _createFinancePermissions(_acl, _finance, _voting, _voting);
    //     _createEvmScriptsRegistryPermissions(_acl, _voting, _voting);
    //     _createVotingPermissions(_acl, _voting, _voting, _tokenManager, _voting);
    //     _createTokenManagerPermissions(_acl, _tokenManager, _voting, _voting);
    // }

    /**
    * @dev Finalize a previously prepared DAO instance cached by the user
    * @param _id String with the name for org, will assign `[id].aragonid.eth`
    * @param _shareHolders Array of share holder addresses
    * @param _shareStakes Array of token stakes for share holders (token has 18 decimals, multiply token amount `* 10^18`)
    * @param _boardMembers Array of board member addresses (1 token will be minted for each board member)
    * @param _financePeriod Initial duration for accounting periods, it can be set to zero in order to use the default of 30 days.
    * @param _useAgentAsVault Boolean to tell whether to use an Agent app as a more advanced form of Vault app
    * @param _payrollSettings Array of [address denominationToken , IFeed priceFeed, uint64 rateExpiryTime, address employeeManager]
             for the payroll app. The `employeeManager` can be set to `0x0` in order to use the board voting app as the employee manager.
    */
    function finalizeInstance(
        string _id,
        address[] _shareHolders,
        uint256[] _shareStakes,
        address[] _boardMembers,
        uint64 _financePeriod,
        bool _useAgentAsVault,
        uint256[4] _payrollSettings
    )
        external
    {
        _ensureFinalizationSettings(_shareHolders, _shareStakes, _boardMembers);
        require(_payrollSettings.length == 4, ERROR_BAD_PAYROLL_SETTINGS);

        // (Kernel dao, Voting shareVoting, Voting boardVoting) = _popDaoCache();
        (Kernel dao, TokenManager boardTokenManager, Voting boardVoting, Vault vault) = _popDaoCache();

        // Finance finance = _setupVaultAndFinanceApps(dao, _financePeriod, _useAgentAsVault, shareVoting, boardVoting);
        // _setupPayrollApp(dao, finance, _payrollSettings, boardVoting);
        // _finalizeApps(dao, _shareHolders, _shareStakes, _boardMembers, shareVoting, boardVoting);

        // _transferRootPermissionsFromTemplate(dao, boardVoting, shareVoting);
        _registerID(_id, address(dao));
    }

    function _finalizeApps(
        Kernel _dao,
        address[] memory _shareHolders,
        uint256[] memory _shareStakes,
        address[] memory _boardMembers,
        Voting _shareVoting,
        Voting _boardVoting
    )
        internal
    {
        // (MiniMeToken shareToken, MiniMeToken boardToken) = _popTokenCaches();

        // // Install
        // TokenManager shareTokenManager = _installTokenManagerApp(_dao, shareToken, SHARE_TRANSFERABLE, SHARE_MAX_PER_ACCOUNT);
        // TokenManager boardTokenManager = _installTokenManagerApp(_dao, boardToken, BOARD_TRANSFERABLE, BOARD_MAX_PER_ACCOUNT);

        // // Mint tokens
        // ACL acl = ACL(_dao.acl());
        // _mintTokens(acl, shareTokenManager, _shareHolders, _shareStakes);
        // _mintTokens(acl, boardTokenManager, _boardMembers, 1);

        // // Assign permissions for token managers
        // _createTokenManagerPermissions(acl, shareTokenManager, _shareVoting, _shareVoting);
        // _createTokenManagerPermissions(acl, boardTokenManager, _shareVoting, _shareVoting);

        // // Assign permissions for votings
        // _createVotingPermissions(acl, _shareVoting, _shareVoting, boardTokenManager, _shareVoting);
        // _createVotingPermissions(acl, _boardVoting, _shareVoting, boardTokenManager, _shareVoting);
    }

    function _setupVaultAndFinanceApps(
        Kernel _dao,
        uint64 _financePeriod,
        bool _useAgentAsVault,
        Voting _shareVoting,
        Voting _boardVoting
    )
        internal
        returns (Finance)
    {
        // Install
        Vault agentOrVault = _useAgentAsVault ? _installDefaultAgentApp(_dao) : _installVaultApp(_dao);
        Finance finance = _installFinanceApp(_dao, agentOrVault, _financePeriod == 0 ? DEFAULT_FINANCE_PERIOD : _financePeriod);

        // Assign permissions
        ACL acl = ACL(_dao.acl());
        if (_useAgentAsVault) {
            _createCustomAgentPermissions(acl, Agent(agentOrVault), _shareVoting, _boardVoting);
        }
        _createVaultPermissions(acl, agentOrVault, finance, _shareVoting);
        _createCustomFinancePermissions(acl, finance, _shareVoting, _boardVoting);

        return finance;
    }

    function _setupPayrollApp(Kernel _dao, Finance _finance, uint256[4] memory _payrollSettings, Voting _boardVoting) internal {
        (address denominationToken, IFeed priceFeed, uint64 rateExpiryTime, address employeeManager) = _unwrapPayrollSettings(_payrollSettings);
        address manager = employeeManager == address(0) ? _boardVoting : employeeManager;

        Payroll payroll = _installPayrollApp(_dao, _finance, denominationToken, priceFeed, rateExpiryTime);
        ACL acl = ACL(_dao.acl());
        _createPayrollPermissions(acl, payroll, manager, _boardVoting, _boardVoting);
    }

    function _createCustomAgentPermissions(ACL _acl, Agent _agent, Voting _shareVoting, Voting _boardVoting) internal {
        address[] memory grantees = new address[](2);
        grantees[0] = address(_shareVoting);
        grantees[1] = address(_boardVoting);

        _createPermissions(_acl, grantees, _agent, _agent.EXECUTE_ROLE(), _shareVoting);
        _createPermissions(_acl, grantees, _agent, _agent.RUN_SCRIPT_ROLE(), _shareVoting);
    }

    function _createCustomFinancePermissions(ACL _acl, Finance _finance, Voting _shareVoting, Voting _boardVoting) internal {
        address[] memory grantees = new address[](2);
        grantees[0] = address(_shareVoting);
        grantees[1] = address(_boardVoting);

        _createPermissions(_acl, grantees, _finance, _finance.CREATE_PAYMENTS_ROLE(), _shareVoting);
        _acl.createPermission(_shareVoting, _finance, _finance.EXECUTE_PAYMENTS_ROLE(), _shareVoting);
        _acl.createPermission(_shareVoting, _finance, _finance.MANAGE_PAYMENTS_ROLE(), _shareVoting);
    }

    function _cachePreparedDao(
        Kernel _dao,
        TokenManager _boardTokenManager,
        Voting _boardVoting,
        Vault _vault
    )
        internal
    {
        Cache storage c = cache[msg.sender];
        c.dao = address(_dao);
        c.boardTokenManager = address(_boardTokenManager);
        c.boardVoting = address(_boardVoting);
        c.vault = address(_vault);

    }

    function _popDaoCache() internal returns (Kernel dao, TokenManager boardTokenManager, Voting boardVoting, Vault vault) {
        Cache storage c = cache[msg.sender];
        require(c.dao != address(0) && c.boardTokenManager != address(0) && c.boardVoting != address(0)  && c.vault != address(0), ERROR_MISSING_CACHE);

        dao = Kernel(c.dao);
        boardTokenManager = TokenManager(c.boardTokenManager);
        boardVoting = Voting(c.boardVoting);
        vault = Vault(c.vault);

        delete c.dao;
        delete c.boardTokenManager;
        delete c.boardVoting;
        delete c.vault;
    }

    // function _popTokenCaches() internal returns (MiniMeToken shareToken, MiniMeToken boardToken) {
    //     Cache storage c = cache[msg.sender];
    //     require(c.shareToken != address(0) && c.boardToken != address(0), ERROR_MISSING_CACHE);

    //     shareToken = MiniMeToken(c.shareToken);
    //     boardToken = MiniMeToken(c.boardToken);
    //     delete c.shareToken;
    //     delete c.boardToken;
    // }

    function _ensureFinalizationSettings(
        address[] memory _shareHolders,
        uint256[] memory _shareStakes,
        address[] memory _boardMembers
    )
        private
        pure
    {
        require(_shareHolders.length > 0, ERROR_MISSING_SHARE_MEMBERS);
        require(_shareHolders.length == _shareStakes.length, ERROR_BAD_HOLDERS_STAKES_LEN);
        require(_boardMembers.length > 0, ERROR_MISSING_BOARD_MEMBERS);
    }
}
