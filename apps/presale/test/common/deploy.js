const getContract = name => artifacts.require(name)
const { hash } = require('eth-ens-namehash')

const DAOFactory = artifacts.require('@aragon/core/contracts/factory/DAOFactory')
const EVMScriptRegistryFactory = artifacts.require('@aragon/core/contracts/factory/EVMScriptRegistryFactory')
const ACL = artifacts.require('@aragon/core/contracts/acl/ACL')
const Kernel = artifacts.require('@aragon/core/contracts/kernel/Kernel')
const MiniMeToken = artifacts.require('@aragon/apps-shared-minime/contracts/MiniMeToken')
const ERC20 = artifacts.require('@aragon/core/contracts/lib/token/ERC20')

const TokenManager = artifacts.require('TokenManager.sol')
const Vault = artifacts.require('Vault.sol')
const Agent = artifacts.require('Agent.sol')

const FundraisingController = artifacts.require('AragonFundraisingControllerMock.sol')
const Tap = artifacts.require('Tap.sol')
const MarketMaker = artifacts.require('BatchedBancorMarketMaker.sol')
// const MarketMakerController = artifacts.require('SimpleMarketMakerController')
const Formula = artifacts.require('BancorFormula.sol')
const Presale = artifacts.require('PresaleMock.sol')

const {
  ANY_ADDRESS,
  ZERO_ADDRESS,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PRESALE_GOAL,
  PERCENT_SUPPLY_OFFERED,
  PRESALE_PERIOD,
  TAP_RATE,
  MAXIMUM_TAP_RATE_INCREASE,
  MAXIMUM_TAP_FLOOR_DECREASE,
  BLOCKS_IN_BATCH,
  SELL_FEE_PERCENT,
  BUY_FEE_PERCENT,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  MARKET_MAKER_CONTROLLER_BATCH_BLOCKS,
  VIRTUAL_SUPPLIES,
  VIRTUAL_BALANCES,
  RESERVE_RATIOS,
  SLIPPAGES,
  RATES,
  FLOORS,
} = require('./constants')

const deploy = {
  getProxyAddress: receipt => receipt.logs.filter(l => l.event === 'NewAppProxy')[0].args.proxy,

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

  /* RESERVE */
  deployReserve: async (test, appManager) => {
    const appBase = await Agent.new()
    const receipt = await test.dao.newAppInstance(hash('pool.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.reserve = Agent.at(deploy.getProxyAddress(receipt))
    test.RESERVE_TRANSFER_ROLE = await appBase.TRANSFER_ROLE()
    test.RESERVE_ADD_PROTECTED_TOKEN_ROLE = await appBase.ADD_PROTECTED_TOKEN_ROLE()
  },
  setReservePermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.reserve.address, test.RESERVE_TRANSFER_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.reserve.address, test.RESERVE_ADD_PROTECTED_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeReserve: async test => {
    await test.reserve.initialize()
  },

  /* TAP */
  deployTap: async (test, appManager) => {
    const appBase = await Tap.new()
    const receipt = await test.dao.newAppInstance(hash('tap.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.tap = Tap.at(deploy.getProxyAddress(receipt))
    test.TAP_ADD_TAPPED_TOKEN_ROLE = await appBase.ADD_TAPPED_TOKEN_ROLE()
    test.TAP_RESET_TAPPED_TOKEN_ROLE = await appBase.RESET_TAPPED_TOKEN_ROLE()
  },
  setTapPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.tap.address, test.TAP_ADD_TAPPED_TOKEN_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.tap.address, test.TAP_RESET_TAPPED_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeTap: async (test, beneficiary) => {
    await test.tap.initialize(test.fundraising.address, test.vault.address, beneficiary, MARKET_MAKER_CONTROLLER_BATCH_BLOCKS, MAXIMUM_TAP_RATE_INCREASE, MAXIMUM_TAP_FLOOR_DECREASE)
  },

  /* MARKET-MAKER-CONTROLLER */
  // deployMarketMakerController: async (test, appManager) => {
  //   const appBase = await MarketMakerController.new()
  //   const receipt = await test.dao.newAppInstance(hash('controller.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
  //   test.marketMakerController = MarketMakerController.at(deploy.getProxyAddress(receipt))
  // },
  // setMarketMakerControllerPermissions: async (test, appManager) => {
  //   // No permissions
  // },
  // initializeMarketMakerController: async test => {
  //   await test.marketMakerController.initialize()
  // },

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
      test.formula.address,
      test.vault.address,
      beneficiary,
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
    test.FUNDRAISING_RESET_TOKEN_TAP_ROLE = await appBase.RESET_TOKEN_TAP_ROLE()
  },
  setFundraisingPermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.fundraising.address, test.FUNDRAISING_ADD_COLLATERAL_TOKEN_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.fundraising.address, test.FUNDRAISING_RESET_TOKEN_TAP_ROLE, appManager, { from: appManager })
  },
  initializeFundraising: async test => {
    await test.fundraising.initialize()
  },

  initializeCollateralTokens: async test => {
    await test.fundraising.addCollateralToken(
      test.contributionToken.address,
      VIRTUAL_SUPPLIES[0],
      VIRTUAL_BALANCES[0],
      RESERVE_RATIOS[0],
      SLIPPAGES[0],
      RATES[0],
      FLOORS[0]
    )

    await test.fundraising.addCollateralToken(
      test.ant.address,
      VIRTUAL_SUPPLIES[1],
      VIRTUAL_BALANCES[1],
      RESERVE_RATIOS[1],
      SLIPPAGES[1],
      RATES[1],
      FLOORS[1]
    )
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
  initializeVault: async test => {
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
  initializeTokenManager: async test => {
    await test.projectToken.changeController(test.tokenManager.address)
    await test.tokenManager.initialize(test.projectToken.address, true /* transferable */, 0 /* macAccountTokens (infinite if set to 0) */)
  },

  /* PRESALE */
  deployPresale: async (test, appManager) => {
    const appBase = await Presale.new()
    const receipt = await test.dao.newAppInstance(hash('presale.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.presale = Presale.at(deploy.getProxyAddress(receipt))
    test.PRESALE_OPEN_ROLE = await appBase.OPEN_ROLE()
    test.PRESALE_CONTRIBUTE_ROLE = await appBase.CONTRIBUTE_ROLE()
  },
  setPresalePermissions: async (test, appManager) => {
    await test.acl.createPermission(appManager, test.presale.address, test.PRESALE_OPEN_ROLE, appManager, { from: appManager })
    await test.acl.createPermission(ANY_ADDRESS, test.presale.address, test.PRESALE_CONTRIBUTE_ROLE, appManager, { from: appManager })
  },
  initializePresale: async (test, params) => {
    const paramsArr = [
      params.fundraising,
      params.tokenManager,
      params.reserve,
      params.beneficiary,
      params.contributionToken,
      params.reserveRatio,
      params.presaleGoal,
      params.presalePeriod,
      params.vestingCliffPeriod,
      params.vestingCompletePeriod,
      params.percentSupplyOffered,
      params.percentFundingForBeneficiary,
      params.startDate,
      params.collaterals,
    ]
    return test.presale.initialize(...paramsArr)
  },
  defaultDeployParams: (test, beneficiary) => {
    return {
      fundraising: test.fundraising.address,
      contributionToken: test.contributionToken.address,
      tokenManager: test.tokenManager.address,
      vestingCliffPeriod: VESTING_CLIFF_PERIOD,
      reserveRatio: RESERVE_RATIOS[0],
      vestingCompletePeriod: VESTING_COMPLETE_PERIOD,
      presaleGoal: PRESALE_GOAL,
      percentSupplyOffered: PERCENT_SUPPLY_OFFERED,
      presalePeriod: PRESALE_PERIOD,
      reserve: test.reserve.address,
      beneficiary,
      percentFundingForBeneficiary: PERCENT_FUNDING_FOR_BENEFICIARY,
      startDate: 0,
      collaterals: [test.contributionToken.address, test.ant.address],
    }
  },

  /* BANCOR FORMULA */
  deployBancorFormula: async test => {
    test.formula = await Formula.new()
  },

  /* TOKENS */
  deployTokens: async test => {
    test.contributionToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'DaiToken', 18, 'DAI', true)
    test.projectToken = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'ProjectToken', 18, 'PRO', true)
    test.ant = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'AntToken', 18, 'ANT', true)
  },

  /* ~EVERYTHING~ */
  prepareDefaultSetup: async (test, appManager) => {
    await deploy.deployDAO(test, appManager)
    deploy.setDAOPermissions(test, appManager)

    await deploy.deployTokens(test)
    await deploy.deployTokenManager(test, appManager)

    await deploy.deployBancorFormula(test, appManager)
    await deploy.deployVault(test, appManager)
    await deploy.deployReserve(test, appManager)
    await deploy.deployTap(test, appManager)
    await deploy.deployMarketMaker(test, appManager)
    await deploy.deployFundraising(test, appManager)
    await deploy.deployPresale(test, appManager)
    // await deploy.deployMarketMakerController(test, appManager)

    await deploy.setVaultPermissions(test, appManager)
    await deploy.setReservePermissions(test, appManager)
    await deploy.setTapPermissions(test, appManager)
    await deploy.setFundraisingPermissions(test, appManager)
    await deploy.setMarketMakerPermissions(test, appManager)
    await deploy.setPresalePermissions(test, appManager)
    await deploy.setTokenManagerPermissions(test, appManager)
    // await deploy.setMarketMakerControllerPermissions(test, appManager)

    await deploy.initializeVault(test)
    await deploy.initializeReserve(test)
    // await deploy.initializeMarketMakerController(test)
    await deploy.initializeTap(test, appManager)
    await deploy.initializeFundraising(test)
    await deploy.initializeTokenManager(test)
    await deploy.initializeMarketMaker(test, appManager)

    await deploy.initializeCollateralTokens(test)
  },
  deployDefaultSetup: async (test, appManager) => {
    await deploy.prepareDefaultSetup(test, appManager)
    return await deploy.initializePresale(test, deploy.defaultDeployParams(test, appManager))
  },
}

module.exports = deploy
