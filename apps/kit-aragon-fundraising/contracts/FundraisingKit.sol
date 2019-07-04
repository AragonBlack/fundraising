pragma solidity 0.4.24;

import "@aragon/os/contracts/common/Uint256Helpers.sol";
import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/os/contracts/kernel/Kernel.sol";
import "@aragon/os/contracts/acl/ACL.sol";
import "@aragon/os/contracts/apm/APMNamehash.sol";
import "@aragon/os/contracts/common/IsContract.sol";
import "@aragon/id/contracts/IFIFSResolvingRegistrar.sol";
import "@aragon/kits-base/contracts/KitBase.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-voting/contracts/Voting.sol";
import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/apps-finance/contracts/Finance.sol";
import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import "@ablack/fundraising-module-tap/contracts/Tap.sol";
import "@ablack/fundraising-controller-aragon-fundraising/contracts/AragonFundraisingController.sol";
import "@ablack/fundraising-market-maker-bancor/contracts/BancorMarketMaker.sol";
import "@ablack/fundraising-formula-bancor/contracts/BancorFormula.sol";


contract FundraisingKit is APMNamehash, IsContract, KitBase {
    using Uint256Helpers for uint256;

    struct Multisig {
        address dao;
        address acl;
        address vault;
        address voting;
    }

    MiniMeTokenFactory public minimeFac;
    IFIFSResolvingRegistrar public aragonID;

    mapping (address => address[2]) tokensCache;
    mapping (address => Multisig) multisigCache;

    event DeployToken(address indexed cacheOwner, address token);
    event DeployMultisigInstance(address dao, address indexed token);
    event DeployFundraisingInstance(address dao, address indexed token);


    constructor(
        DAOFactory _fac,
        ENS _ens,
        MiniMeTokenFactory _minimeFac,
        IFIFSResolvingRegistrar _aragonID
    )
        KitBase(_fac, _ens) public
    {
        require(isContract(address(_fac.regFactory())));

        minimeFac = _minimeFac;
        aragonID = _aragonID;
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
            "Bonds",
            18,
            "BONDS",
            true
        );

        _cacheTokens(msg.sender, token1, token2);
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

        // required for initializing the Token Manager
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

        // apps initialization
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

        // token stakes settings
        acl.createPermission(this, tokenManager, tokenManager.MINT_ROLE(), this);
        for (uint i = 0; i < signers.length; i++) {
            tokenManager.mint(signers[i], 1);
        }
        cleanupPermission(acl, voting, tokenManager, tokenManager.MINT_ROLE());

        // EVMScriptRegistry permissions
        // EVMScriptRegistry reg = EVMScriptRegistry(acl.getEVMScriptRegistry());
        // acl.createPermission(voting, reg, reg.REGISTRY_ADD_EXECUTOR_ROLE(), voting);
        // acl.createPermission(voting, reg, reg.REGISTRY_MANAGER_ROLE(), voting);

        // aragonID registration
        registerAragonID(aragonId, dao);

        _cacheMultisig(msg.sender, token, dao, acl, vault, voting);
        emit DeployMultisigInstance(dao, token);
    }

      function newFundraisingInstance(address _collateralToken1, address _collateralToken2) public {
          require(isContract(_collateralToken1));
          require(isContract(_collateralToken2));

          Kernel dao;
          ACL    acl;
          Vault  vault;
          Voting multisig;

          (dao, acl, vault, multisig) = _popMultisigCache(msg.sender);

          bytes32[7] memory apps = [
              apmNamehash("fundraising-module-pool"),   // 0
              apmNamehash("fundraising-module-tap"),    // 1
              apmNamehash("fundraising-controller-aragon-fundraising"),           // 2
              apmNamehash("fundraising-market-maker-bancor"), // 3
              apmNamehash("fundraising-formula-bancor"), //4
              apmNamehash("token-manager"), //5
              apmNamehash("voting")  // 6
          ];

          MiniMeToken token = _popTokensCache(msg.sender, uint256(1));

          TokenManager tokenManager = TokenManager(dao.newAppInstance(apps[5], latestVersionAppBase(apps[5])));
          emit InstalledApp(tokenManager, apps[5]);

          Voting voting = Voting(dao.newAppInstance(apps[6], latestVersionAppBase(apps[6])));
          emit InstalledApp(voting, apps[6]);

          // // Install fundraising app instances
          Pool pool = Pool(dao.newAppInstance(apps[0], latestVersionAppBase(apps[0])));
          emit InstalledApp(pool, apps[0]);

          Tap tap = Tap(dao.newAppInstance(apps[1], latestVersionAppBase(apps[1])));
          emit InstalledApp(tap, apps[1]);

          AragonFundraisingController controller = AragonFundraisingController(dao.newAppInstance(apps[2], latestVersionAppBase(apps[2])));
          emit InstalledApp(controller, apps[2]);

          BancorMarketMaker marketMaker = BancorMarketMaker(dao.newAppInstance(apps[3], latestVersionAppBase(apps[3])));
          emit InstalledApp(marketMaker, apps[3]);

          // Token Manager
          acl.createPermission(marketMaker, tokenManager, tokenManager.BURN_ROLE(), voting);
          acl.createPermission(marketMaker, tokenManager, tokenManager.MINT_ROLE(), voting);

          // Voting
          acl.createPermission(tokenManager, voting, voting.CREATE_VOTES_ROLE(), voting);
          acl.createPermission(voting, voting, voting.MODIFY_QUORUM_ROLE(), voting);
          acl.createBurnedPermission(voting, voting.MODIFY_SUPPORT_ROLE());

          // Tap
          acl.createPermission(multisig, tap, tap.UPDATE_BENEFICIARY_ROLE(), multisig);
          acl.createPermission(controller, tap, tap.UPDATE_MONTHLY_TAP_INCREASE_ROLE(), voting);
          acl.createPermission(controller, tap, tap.ADD_TOKEN_TAP_ROLE(), voting);
          acl.createPermission(controller, tap, tap.UPDATE_TOKEN_TAP_ROLE(), voting);
          acl.createPermission(controller, tap, tap.WITHDRAW_ROLE(), multisig);

          // BancorMarketMaker
          acl.createPermission(controller, marketMaker, marketMaker.ADD_COLLATERAL_TOKEN_ROLE(), voting);
          acl.createPermission(controller, marketMaker, marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(), voting);
          acl.createPermission(controller, marketMaker, marketMaker.UPDATE_FEES_ROLE(), voting);
          acl.createPermission(controller, marketMaker, marketMaker.CREATE_BUY_ORDER_ROLE(), voting);
          acl.createPermission(controller, marketMaker, marketMaker.CREATE_SELL_ORDER_ROLE(), voting);

          // Pool
          acl.createPermission(voting, pool, pool.SAFE_EXECUTE_ROLE(), voting);
          acl.createPermission(controller, pool, pool.ADD_COLLATERAL_TOKEN_ROLE(), voting);
          acl.createPermission(tap, pool, pool.TRANSFER_ROLE(), this);
          acl.grantPermission(marketMaker, pool, pool.TRANSFER_ROLE());
          cleanupPermission(acl, voting, pool, pool.TRANSFER_ROLE());

          // Controller
          acl.createPermission(this, controller, controller.ADD_COLLATERAL_TOKEN_ROLE(), this);
          acl.createPermission(voting, controller, controller.UPDATE_TOKEN_TAP_ROLE(), voting);
          acl.createPermission(voting, controller, controller.UPDATE_MONTHLY_TAP_INCREASE_ROLE(), voting);
          acl.createPermission(address(-1), controller, controller.CREATE_BUY_ORDER_ROLE(), voting);
          acl.createPermission(address(-1), controller, controller.CREATE_SELL_ORDER_ROLE(), voting);
          acl.createPermission(multisig, controller, controller.WITHDRAW_ROLE(), multisig);

        // initialize apps
        token.changeController(tokenManager);
        tokenManager.initialize(token, true, 0);
        voting.initialize(token, uint64(50 * 10 ** 16), uint64(20 * 10 ** 16), 7 days);
        pool.initialize();
        tap.initialize(vault, address(pool), uint256(50 * 10 ** 16));
        marketMaker.initialize(
          controller,
          tokenManager,
          Vault(pool),
          vault,
          BancorFormula(latestVersionAppBase(apmNamehash("fundraising-formula-bancor"))),
          1,
          uint256(0),
          uint256(0)
        );
        controller.initialize(marketMaker, pool, tap);

        // add collateral tokens
        controller.addCollateralToken(_collateralToken1, 100, 100, 1 * 10**5, 400 * 10^9);
        controller.addCollateralToken(_collateralToken2, 100, 100, 1 * 10**5, 400 * 10^9);

        // clean-up
        cleanupPermission(acl, voting, controller, controller.ADD_COLLATERAL_TOKEN_ROLE());
        cleanupDAOPermissions(dao, acl, voting);

        emit DeployFundraisingInstance(dao, token);
    }

    function _cacheTokens(address _owner, MiniMeToken _multisigToken, MiniMeToken _bondedToken) internal {
        tokensCache[_owner][0] = _multisigToken;
        tokensCache[_owner][1] = _bondedToken;

        emit DeployToken(_owner, _multisigToken);
        emit DeployToken(_owner, _bondedToken);
    }

    function _popTokensCache(address _owner, uint256 _which) internal returns (MiniMeToken) {
        require(_which < 2);
        require(tokensCache[_owner][_which] != address(0));

        MiniMeToken token = MiniMeToken(tokensCache[_owner][_which]);
        delete tokensCache[_owner][_which];

        return token;
    }

    function _cacheMultisig(address _owner, address _token, address _dao, address _acl, address _vault, address _voting) internal {
        Multisig storage multisig = multisigCache[_owner];

        multisig.dao = _dao;
        multisig.acl = _acl;
        multisig.vault = _vault;
        multisig.voting = _voting;

        emit DeployMultisigInstance(_dao, _token);
    }

    function _popMultisigCache(address _owner) internal returns (Kernel dao, ACL acl, Vault vault, Voting voting) {
        require(multisigCache[_owner].dao != address(0));

        Multisig storage multisig = multisigCache[_owner];

        dao = Kernel(multisig.dao);
        acl = ACL(multisig.acl);
        vault = Vault(multisig.vault);
        voting = Voting(multisig.voting);

        delete multisigCache[_owner];
    }

    function registerAragonID(string name, address owner) internal {
        aragonID.register(keccak256(abi.encodePacked(name)), owner);
    }
}
