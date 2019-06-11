pragma solidity 0.4.24;

import "@aragon/os/contracts/common/Uint256Helpers.sol";
import "@aragon/os/contracts/apm/APMNamehash.sol";
import "@aragon/kits-beta-base/contracts/BetaKitBase.sol";
import "@ablack/fundraising-interface-core/contracts/IMarketMakerController.sol";
import "@ablack/fundraising-market-maker-bancor/contracts/BancorMarketMaker.sol";
import "@ablack/fundraising-controller-aragon-fundraising/contracts/AragonFundraisingController.sol";
import "@ablack/fundraising-formula-bancor/contracts/interfaces/IBancorFormula.sol";
import "@ablack/fundraising-formula-bancor/contracts/BancorFormula.sol";
import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import "@ablack/fundraising-module-tap/contracts/Tap.sol";


contract FundraisingKit is APMNamehash, BetaKitBase {
    using Uint256Helpers for uint256;

    mapping (address => address[2]) tokensCache;
    mapping (address => Multisig) multisigCache;

    struct Multisig {
        address dao;
        address acl;
        address vault;
        address voting;
    }

    event DeployMultisigInstance(address dao, address indexed token);
    event DeployFundraisingInstance(address dao, address indexed token);


    constructor(
        DAOFactory _fac,
        ENS _ens,
        MiniMeTokenFactory _minimeFac,
        IFIFSResolvingRegistrar _aragonID,
        bytes32[4] _appIds
    )
        BetaKitBase(_fac, _ens, _minimeFac, _aragonID, _appIds) public
    {
        // solium-disable-previous-line no-empty-blocks
    }

    function newToken(string tokenName, string tokenSymbol) public returns (MiniMeToken token) {
        token = minimeFac.createCloneToken(
            MiniMeToken(address(0)),
            0,
            tokenName,
            0,
            tokenSymbol,
            true
        );

      

        cacheToken(token, msg.sender);
    }

    function newTokens(string tokenName, string tokenSymbol) public {
        MiniMeToken token1 = minimeFac.createCloneToken(
            MiniMeToken(address(0)),
            0,
            tokenName,
            0,
            tokenSymbol,
            true
        );

        MiniMeToken token2 = minimeFac.createCloneToken(
            MiniMeToken(address(0)),
            0,
            'Bonds',
            18,
            'BONDS',
            true
        );

        _cacheTokens(token1, token2, msg.sender);
    }

    function newMultisigInstance(string aragonId, address[] signers, uint256 neededSignatures) public {
        require(signers.length > 0 && neededSignatures > 0);
        require(neededSignatures <= signers.length);

        bytes32[4] memory apps = [
            apmNamehash("voting"),       // 0
            apmNamehash("vault"),        // 1
            apmNamehash("finance"),      // 2
            apmNamehash("token-manager") // 3
        ];

        MiniMeToken token = _popTokensCache(msg.sender, uint256(0));
        Kernel      dao = fac.newDAO(this);
        ACL         acl = ACL(dao.acl());

        acl.createPermission(this, dao, dao.APP_MANAGER_ROLE(), this);

        Voting voting = Voting(dao.newAppInstance(apps[0], latestVersionAppBase(apps[0])));
        emit InstalledApp(voting, apps[0]);

        Vault vault = Vault(dao.newAppInstance(apps[1], latestVersionAppBase(apps[1])));
        emit InstalledApp(vault, apps[1]);

        Finance finance = Finance(dao.newAppInstance(apps[2], latestVersionAppBase(apps[2])));
        emit InstalledApp(finance, apps[2]);

        TokenManager tokenManager = TokenManager(dao.newAppInstance(apps[3], latestVersionAppBase(apps[3])));
        emit InstalledApp(tokenManager, apps[3]);

        // Required for initializing the Token Manager
        token.changeController(tokenManager);

        // permissions
        acl.createPermission(tokenManager, voting, voting.CREATE_VOTES_ROLE(), voting);
        acl.createPermission(voting, voting, voting.MODIFY_QUORUM_ROLE(), voting);
        acl.createPermission(voting, voting, voting.MODIFY_SUPPORT_ROLE(), voting);
        acl.createPermission(finance, vault, vault.TRANSFER_ROLE(), voting);
        acl.createPermission(voting, finance, finance.CREATE_PAYMENTS_ROLE(), voting);
        acl.createPermission(voting, finance, finance.EXECUTE_PAYMENTS_ROLE(), voting);
        acl.createPermission(voting, finance, finance.MANAGE_PAYMENTS_ROLE(), voting);
        acl.createPermission(voting, tokenManager, tokenManager.ASSIGN_ROLE(), voting);
        acl.createPermission(voting, tokenManager, tokenManager.REVOKE_VESTINGS_ROLE(), voting);

        // App inits
        uint256 multisigSupport = neededSignatures * 10 ** 18 / signers.length - 1;
        vault.initialize();
        finance.initialize(vault, 30 days);
        tokenManager.initialize(token, false, 1);
        voting.initialize(
            token,
            multisigSupport.toUint64(),
            multisigSupport.toUint64(),
            1825 days // ~5 years
        );

        // Set up the token stakes
        acl.createPermission(this, tokenManager, tokenManager.MINT_ROLE(), this);

        for (uint i = 0; i < signers.length; i++) {
            tokenManager.mint(signers[i], 1);
        }

        // EVMScriptRegistry permissions
        EVMScriptRegistry reg = EVMScriptRegistry(acl.getEVMScriptRegistry());
        acl.createPermission(voting, reg, reg.REGISTRY_ADD_EXECUTOR_ROLE(), voting);
        acl.createPermission(voting, reg, reg.REGISTRY_MANAGER_ROLE(), voting);

        // clean-up
        cleanupPermission(acl, voting, tokenManager, tokenManager.MINT_ROLE());
        // cleanupPermission(acl, voting, acl, acl.CREATE_PERMISSIONS_ROLE()); //RE-ADD AT THE END OF FUNDRAISING INSTANCE

        registerAragonID(aragonId, dao);

        cacheMultisig(msg.sender, dao, acl, vault, voting);
        
        emit DeployMultisigInstance(dao, token);
    }

    function newFundraisingInstance() public {

        Kernel dao;
        ACL    acl;
        Vault  vault;
        Voting multisig;

        (dao, acl, vault, multisig) = _popMultisigCache(msg.sender);

        bytes32[2] memory appsA1 = [
            apmNamehash("token-manager"),   // 0
            apmNamehash("voting")           // 1
        ];

        bytes32[5] memory apps = [
            apmNamehash("fundraising-module-pool"),   // 0
            apmNamehash("fundraising-module-tap"),    // 1
            apmNamehash("fundraising-controller-aragon-fundraising"),           // 2
            apmNamehash("fundraising-market-maker-bancor"), // 3
            apmNamehash("fundraising-formula-bancor") //4
        ];


        // MiniMeToken token = _popTokensCache(msg.sender, uint256(1));

        TokenManager tokenManager = TokenManager(dao.newAppInstance(appsA1[0], latestVersionAppBase(appsA1[0])));
        emit InstalledApp(tokenManager, appsA1[0]);

        Voting voting = Voting(dao.newAppInstance(appsA1[1], latestVersionAppBase(appsA1[1])));
        emit InstalledApp(voting, appsA1[0]);

        // // Install fundraising app instances
        Pool pool = Pool(dao.newAppInstance(apps[0], latestVersionAppBase(apps[0])));
        emit InstalledApp(pool, apps[0]);

        Tap tap = Tap(dao.newAppInstance(apps[1], latestVersionAppBase(apps[1])));
        emit InstalledApp(tap, apps[1]);

        // Tap tap2 = Tap(dao.newAppInstance(apps[1], latestVersionAppBase(apps[1])));
        // emit InstalledApp(tap, apps[1]);

        AragonFundraisingController controller = AragonFundraisingController(dao.newAppInstance(apps[2], latestVersionAppBase(apps[2])));
        emit InstalledApp(controller, apps[2]);

        BancorMarketMaker marketMaker = BancorMarketMaker(dao.newAppInstance(apps[3], latestVersionAppBase(apps[3])));
        emit InstalledApp(marketMaker, apps[3]);

        // // Permissions -- ANY_ENTITY === address(-1)
        // acl.grantPermission(fundraising, dao, dao.APP_MANAGER_ROLE());
        // acl.grantPermission(fundraising, acl, acl.CREATE_PERMISSIONS_ROLE());

        // // Token Manager
        // acl.createPermission(voting, tokenManager, tokenManager.ISSUE_ROLE(), voting);
        // acl.createPermission(voting, tokenManager, tokenManager.ASSIGN_ROLE(), voting);
        // acl.createPermission(voting, tokenManager, tokenManager.REVOKE_VESTINGS_ROLE(), voting);
        // acl.createPermission(marketMaker, tokenManager, tokenManager.BURN_ROLE(), voting);
        // acl.createPermission(marketMaker, tokenManager, tokenManager.MINT_ROLE(), voting);

        // // Tap
        acl.createPermission(voting, tap, tap.UPDATE_RESERVE_ROLE(), voting);
        acl.createPermission(voting, tap, tap.UPDATE_BENEFICIARY_ROLE(), voting);
        acl.createPermission(voting, tap, tap.UPDATE_MONTHLY_TAP_INCREASE_ROLE(), voting);
        acl.createPermission(voting, tap, tap.ADD_TOKEN_TAP_ROLE(), voting);
        acl.createPermission(voting, tap, tap.REMOVE_TOKEN_TAP_ROLE(), voting);
        acl.createPermission(voting, tap, tap.UPDATE_TOKEN_TAP_ROLE(), voting);
        acl.createPermission(address(-1), tap, tap.WITHDRAW_ROLE(), voting);

        // // BancorMarketMaker
        // acl.createPermission(voting, marketMaker, marketMaker.ADD_COLLATERAL_TOKEN_ROLE(), voting);
        // acl.createPermission(voting, marketMaker, marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(), voting);
        // acl.createPermission(voting, marketMaker, marketMaker.UPDATE_FEES_ROLE(), voting);
        // acl.createPermission(address(-1), marketMaker, marketMaker.CREATE_BUY_ORDER_ROLE(), marketMaker);
        // acl.createPermission(address(-1), marketMaker, marketMaker.CREATE_SELL_ORDER_ROLE(), marketMaker);

        // // Pool
        // acl.createPermission(marketMaker, pool, pool.SAFE_EXECUTE_ROLE(), voting);
        // acl.createPermission(tap, pool, pool.SAFE_EXECUTE_ROLE(), voting);
        // acl.createPermission(voting, pool, pool.ADD_COLLATERAL_TOKEN_ROLE(), voting);
        // acl.createPermission(voting, pool, pool.REMOVE_COLLATERAL_TOKEN_ROLE(), voting);

        // // Voting
        // acl.createPermission(address(-1), voting, voting.CREATE_VOTES_ROLE(), voting);
        // acl.createPermission(voting, voting, voting.MODIFY_SUPPORT_ROLE(), voting);

        // // Vault
        // acl.createPermission(tap, vault, vault.TRANSFER_ROLE(), vault);

        // // Fundraising
        // acl.createPermission(voting, fundraising, fundraising.UPDATE_FEES_ROLE(), voting);
        // acl.createPermission(voting, fundraising, fundraising.UPDATE_BENEFICIARY_ROLE(), voting);
        // acl.createPermission(voting, fundraising, fundraising.ADD_COLLATERAL_TOKEN_ROLE(), voting);
        // acl.createPermission(voting, fundraising, fundraising.UPDATE_TOKEN_TAP_ROLE(), voting);
        // acl.createPermission(voting, fundraising, fundraising.UPDATE_MONTHLY_TAP_INCREASE_ROLE(), voting);
        // acl.createPermission(address(-1), fundraising, fundraising.CREATE_BUY_ORDER_ROLE(), fundraising);
        // acl.createPermission(address(-1), fundraising, fundraising.CREATE_SELL_ORDER_ROLE(), fundraising);
        // acl.createPermission(address(-1), fundraising, fundraising.WITHDRAW_ROLE(), fundraising);

        // IBancorFormula formula = IBancorFormula(latestVersionAppBase(apmNamehash("fundraising-formula-bancor")));

        // // Intialization
        // pool.initialize();
        // tap.initialize(vault, address(pool), uint256(50 * 10 ** 16));
        // marketMaker.initialize(
        //   fundraising,
        //   tokenManager,
        //   vault,
        //   address(pool),
        //   formula,
        //   1,
        //   uint256(10 ** 14),
        //   uint256(10 ** 14)
        // );
        // fundraising.initialize(marketMaker, pool, tap);
    }

    function _cacheTokens(MiniMeToken token1, MiniMeToken token2, address owner) internal {
        tokensCache[owner][0] = token1;
        tokensCache[owner][1] = token2;

        emit DeployToken(token1, owner);
        emit DeployToken(token2, owner);

    }

    function _popTokensCache(address owner, uint256 which) internal returns (MiniMeToken) {
        require(which < 2);
        require(tokensCache[owner][which] != address(0));
        MiniMeToken token = MiniMeToken(tokensCache[owner][which]);
        delete tokensCache[owner][which];

        return token;
    }

    function cacheMultisig(address owner, address dao, address acl, address vault, address voting) internal {
        Multisig storage multisig = multisigCache[owner];

        multisig.dao = dao;
        multisig.acl = acl;
        multisig.vault = vault;
        multisig.voting = voting;
    }

    function _popMultisigCache(address owner) internal returns (Kernel dao, ACL acl, Vault vault, Voting voting) {
        require(multisigCache[owner].dao != address(0));

        Multisig multisig = multisigCache[owner];

        dao = Kernel(multisig.dao);
        acl = ACL(multisig.acl);
        vault = Vault(multisig.vault);
        voting = Voting(multisig.voting);

        delete multisigCache[owner];
    }
}
