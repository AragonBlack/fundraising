const Presale = artifacts.require('PresaleMock.sol')
const FundraisingController = artifacts.require('AragonFundraisingController.sol')
const MiniMeToken = artifacts.require('@aragon/apps-shared-minime/contracts/MiniMeToken')
const TokenManager = artifacts.require('TokenManager.sol')
const Vault = artifacts.require('Vault.sol')
const Pool = artifacts.require('Pool.sol')
const Tap = artifacts.require('Tap.sol')
const MarketMaker = artifacts.require('BatchedBancorMarketMaker.sol')
const MarketMakerController = artifacts.require('SimpleMarketMakerController')
const Formula = artifacts.require('BancorFormula.sol')
const DAOFactory = artifacts.require('@aragon/core/contracts/factory/DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('@aragon/core/contracts/factory/EVMScriptRegistryFactory')
const ACL = artifacts.require('@aragon/core/contracts/acl/ACL')
const Kernel = artifacts.require('@aragon/core/contracts/kernel/Kernel')
const ERC20 = artifacts.require('@aragon/core/contracts/lib/token/ERC20')
const getContract = name => artifacts.require(name)
const { hash } = require('eth-ens-namehash')

const {
  ANY_ADDRESS,
  ZERO_ADDRESS,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  DAI_FUNDING_GOAL,
  PERCENT_SUPPLY_OFFERED,
  FUNDING_PERIOD,
  TAP_RATE,
  MAX_MONTHLY_TAP_INCREASE_RATE,
  BLOCKS_IN_BATCH,
  SELL_FEE_PERCENT,
  BUY_FEE_PERCENT,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  MARKET_MAKER_CONTROLLER_BATCH_BLOCKS
} = require('./constants')

const deploy = {

  getProxyAddress: (receipt) => receipt.logs.filter(l => l.event === 'NewAppProxy')[0].args.proxy,

  /* DAO */
  deployDAO: async (test, daoManager) => {
    const kernelBase = await getContract('Kernel').new(true) // petrify immediately
    const aclBase = await getContract('ACL').new()
    const regFact = await EVMScriptRegistryFactory.new()
    const daoFact = await DAOFactory.new(kernelBase.address, aclBase.address, regFact.address)
    const daoReceipt = await daoFact.newDAO(daoManager)
    test.dao = Kernel.at(daoReceipt.logs.filter(l => l.event === 'DeployDAO')[0].args.dao)
    test.acl = ACL.at(await test.dao.acl())
    test.APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
  },
  setDAOPermissions: async (test, daoManager) => {
    await test.acl.createPermission(daoManager, test.dao.address, test.APP_MANAGER_ROLE, daoManager, { from: daoManager })
  },

  /* POOL */
  deployPool: async (test, appManager) => {
    const appBase = await Pool.new()
    const receipt = await test.dao.newAppInstance(hash('pool.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.pool = Pool.at(deploy.getProxyAddress(receipt))
    test.POOL_TRANSFER_ROLE = await appBase.TRANSFER_ROLE()
    test.POOL_ADD_PROTECTED_TOKEN_ROLE = await appBase.ADD_PROTECTED_TOKEN_ROLE()
  },
  setPoolPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.pool.address, test.POOL_TRANSFER_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.pool.address, test.POOL_ADD_PROTECTED_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializePool: async (test) => {
    await test.pool.initialize()
  },

  /* TAP */
  deployTap: async (test, appManager) => {
    const appBase = await Tap.new()
    const receipt = await test.dao.newAppInstance(hash('tap.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.tap = Tap.at(deploy.getProxyAddress(receipt))
    test.TAP_ADD_TAPPED_TOKEN_ROLE = await appBase.ADD_TAPPED_TOKEN_ROLE()
  },
  setTapPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.tap.address, test.TAP_ADD_TAPPED_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeTap: async (test, beneficiary) => {
    await test.tap.initialize(
      test.marketMakerController.address,
      test.vault.address,
      beneficiary,
      MARKET_MAKER_CONTROLLER_BATCH_BLOCKS,
      MAX_MONTHLY_TAP_INCREASE_RATE
    )
  },

  /* MARKET-MAKER-CONTROLLER */
  deployMarketMakerController: async (test, appManager) => {
    const appBase = await MarketMakerController.new()
    const receipt = await test.dao.newAppInstance(hash('controller.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.marketMakerController = MarketMakerController.at(deploy.getProxyAddress(receipt))
  },
  setMarketMakerControllerPermissions: async (test, appManager) => {
    // No permissions
  },
  initializeMarketMakerController: async (test) => {
    await test.marketMakerController.initialize()
  },

  /* MARKET-MAKER */
  deployMarketMaker: async (test, appManager) => {
    const appBase = await MarketMaker.new()
    const receipt = await test.dao.newAppInstance(hash('bancor-market-maker.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.marketMaker = MarketMaker.at(deploy.getProxyAddress(receipt))
    test.MARKET_MAKER_ADD_COLLATERAL_TOKEN_ROLE = await appBase.ADD_COLLATERAL_TOKEN_ROLE()
  },
  setMarketMakerPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.marketMaker.address, test.MARKET_MAKER_ADD_COLLATERAL_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeMarketMaker: async (test, beneficiary) => {
    await test.marketMaker.initialize(
			test.fundraising.address,
      test.tokenManager.address,
      test.vault.address,
      beneficiary,
      test.formula.address,
      BLOCKS_IN_BATCH,
      BUY_FEE_PERCENT,
      SELL_FEE_PERCENT
		)
  },

  /* FUNDRAISING */
  deployFundraising: async (test, appManager) => {
    const appBase = await FundraisingController.new()
    const receipt = await test.dao.newAppInstance(hash('fundraising-controller.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.fundraising = FundraisingController.at(deploy.getProxyAddress(receipt))
    test.FUNDRAISING_ADD_COLLATERAL_TOKEN_ROLE = await appBase.ADD_COLLATERAL_TOKEN_ROLE()
  },
  setFundraisingPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.fundraising.address, test.FUNDRAISING_ADD_COLLATERAL_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeFundraising: async (test) => {
    await test.fundraising.initialize(test.marketMaker.address, test.pool.address, test.tap.address)
  },

  /* VAULT */
  deployVault: async (test, appManager) => {
    const appBase = await Vault.new()
    const receipt = await test.dao.newAppInstance(hash('vault.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.vault = Vault.at(deploy.getProxyAddress(receipt))
  },
  setVaultPermissions: async (test, appManager) => {
    // No permissions
  },
  initializeVault: async (test) => {
    await test.vault.initialize()
  },

  /* TOKEN MANAGER */
  deployTokenManager: async (test, appManager) => {
    const appBase = await TokenManager.new()
    const receipt = await test.dao.newAppInstance(hash('token-manager.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.tokenManager = TokenManager.at(deploy.getProxyAddress(receipt))
    test.TOKEN_MANAGER_MINT_ROLE = await appBase.MINT_ROLE()
    test.TOKEN_MANAGER_ISSUE_ROLE = await appBase.ISSUE_ROLE()
    test.TOKEN_MANAGER_ASSIGN_ROLE = await appBase.ASSIGN_ROLE()
    test.TOKEN_MANAGER_REVOKE_VESTINGS_ROLE = await appBase.REVOKE_VESTINGS_ROLE()
    test.TOKEN_MANAGER_BURN_ROLE = await appBase.BURN_ROLE()
  },
  setTokenManagerPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_MINT_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_BURN_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_REVOKE_VESTINGS_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_ISSUE_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tokenManager.address, test.TOKEN_MANAGER_ASSIGN_ROLE, appManager, { from: appManager })
  },
  initializeTokenManager: async (test) => {
    await test.projectToken.changeController(test.tokenManager.address)
    await test.tokenManager.initialize(
      test.projectToken.address,
      true, /* transferable */
      0 /* macAccountTokens (infinite if set to 0) */
    )
  },

  /* PRESALE */
  deployPresale: async (test, appManager) => {
    const appBase = await Presale.new()
    const receipt = await test.dao.newAppInstance(hash('presale.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.presale = Presale.at(deploy.getProxyAddress(receipt))
    test.PRESALE_START_ROLE = await appBase.START_ROLE()
    test.PRESALE_BUY_ROLE = await appBase.BUY_ROLE()
  },
  setPresalePermissions: async (test, appManager) => {
    await test.acl.createPermission(appManager, test.presale.address, test.PRESALE_START_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.presale.address, test.PRESALE_BUY_ROLE, appManager, { from: appManager })
  },
  initializePresale: async (test, params) => {
    const paramsArr = [
      params.daiToken,
      params.projectToken,
      params.tokenManager,
      params.vestingCliffPeriod,
      params.vestingCompletePeriod,
      params.daiFundingGoal,
      params.percentSupplyOffered,
      params.fundingPeriod,
      params.pool,
      params.fundraising,
      params.tapRate,
      params.beneficiaryAddress,
      params.percentFundingForBeneficiary
    ]
    return test.presale.initialize(...paramsArr)
  },
  defaultDeployParams: (test, beneficiaryAddress) => {
    return {
      daiToken: test.daiToken.address,
      projectToken: test.projectToken.address,
      tokenManager: test.tokenManager.address,
      vestingCliffPeriod: VESTING_CLIFF_PERIOD,
      vestingCompletePeriod: VESTING_COMPLETE_PERIOD,
      daiFundingGoal: DAI_FUNDING_GOAL,
      percentSupplyOffered: PERCENT_SUPPLY_OFFERED,
      fundingPeriod: FUNDING_PERIOD,
      pool: test.pool.address,
      fundraising: test.fundraising.address,
      tapRate: TAP_RATE,
      beneficiaryAddress,
      percentFundingForBeneficiary: PERCENT_FUNDING_FOR_BENEFICIARY
    }
  },

  /* BANCOR FORMULA */
  deployBancorFormula: async (test) => {
    test.formula = await Formula.new()
  },

  /* TOKENS */
  deployTokens: async (test) => {
    test.daiToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'DaiToken', 18, 'DAI', true)
    test.projectToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'ProjectToken', 18, 'PRO', true)
  },

  /* ~EVERYTHING~ */
  prepareDefaultSetup: async (test, appManager) => {
    await deploy.deployDAO(test, appManager)
    deploy.setDAOPermissions(test, appManager)

    await deploy.deployTokens(test)
    await deploy.deployTokenManager(test, appManager)

		await deploy.deployBancorFormula(test, appManager)

    await deploy.deployVault(test, appManager)
    await deploy.deployPool(test, appManager)
    await deploy.deployTap(test, appManager)
    await deploy.deployMarketMaker(test, appManager)
    await deploy.deployFundraising(test, appManager)
    await deploy.deployPresale(test, appManager)
    await deploy.deployMarketMakerController(test, appManager)

    await deploy.setVaultPermissions(test, appManager)
    await deploy.setPoolPermissions(test, appManager)
    await deploy.setTapPermissions(test, appManager)
    await deploy.setFundraisingPermissions(test, appManager)
    await deploy.setMarketMakerPermissions(test, appManager)
    await deploy.setPresalePermissions(test, appManager)
    await deploy.setTokenManagerPermissions(test, appManager)
    await deploy.setMarketMakerControllerPermissions(test, appManager)

    await deploy.initializeVault(test)
    await deploy.initializePool(test)
    await deploy.initializeMarketMakerController(test)
    await deploy.initializeTap(test, appManager)
    await deploy.initializeFundraising(test)
    await deploy.initializeMarketMaker(test, appManager)
    await deploy.initializeTokenManager(test)
  },
  deployDefaultSetup: async (test, appManager) => {
    await deploy.prepareDefaultSetup(test, appManager)
    return await deploy.initializePresale(test, deploy.defaultDeployParams(test, appManager))
  }
}

module.exports = deploy
