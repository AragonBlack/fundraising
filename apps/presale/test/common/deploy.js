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
const FundraisingController = artifacts.require('AragonFundraisingControllerMock.sol')
const Presale = artifacts.require('PresaleMock.sol')

const {
  ANY_ADDRESS,
  ZERO_ADDRESS,
  PRESALE_GOAL,
  PRESALE_PERIOD,
  PRESALE_EXCHANGE_RATE,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PERCENT_SUPPLY_OFFERED,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  RESERVE_RATIOS,
  BUY_FEE_PCT,
  SELL_FEE_PCT,
} = require('@ablack/fundraising-shared-test-helpers/constants')

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
    const appBase = await Vault.new()
    const receipt = await test.dao.newAppInstance(hash('pool.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.reserve = Vault.at(deploy.getProxyAddress(receipt))
    test.RESERVE_TRANSFER_ROLE = await appBase.TRANSFER_ROLE()
    // test.RESERVE_ADD_PROTECTED_TOKEN_ROLE = await appBase.ADD_PROTECTED_TOKEN_ROLE()
  },
  setReservePermissions: async (test, appManager) => {
    await test.acl.createPermission(ANY_ADDRESS, test.reserve.address, test.RESERVE_TRANSFER_ROLE, appManager, { from: appManager })
    // await test.acl.createPermission(ANY_ADDRESS, test.reserve.address, test.RESERVE_ADD_PROTECTED_TOKEN_ROLE, appManager, { from: appManager })
  },
  initializeReserve: async test => {
    await test.reserve.initialize()
  },

  /* FUNDRAISING */
  deployFundraising: async (test, appManager) => {
    const appBase = await FundraisingController.new()
    const receipt = await test.dao.newAppInstance(hash('fundraising-controller.aragonpm.eth'), appBase.address, '0x', false, { from: appManager })
    test.fundraising = FundraisingController.at(deploy.getProxyAddress(receipt))
  },
  setFundraisingPermissions: async (test, appManager) => {},
  initializeFundraising: async test => {
    await test.fundraising.initialize()
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
      params.presaleGoal,
      params.presalePeriod,
      params.presaleExchangeRate,
      params.vestingCliffPeriod,
      params.vestingCompletePeriod,
      params.percentSupplyOffered,
      params.percentFundingForBeneficiary,
      params.startDate,
    ]
    return test.presale.initialize(...paramsArr)
  },
  defaultDeployParams: (test, beneficiary) => {
    return {
      fundraising: test.fundraising.address,
      contributionToken: test.contributionToken.address,
      tokenManager: test.tokenManager.address,
      vestingCliffPeriod: VESTING_CLIFF_PERIOD,
      vestingCompletePeriod: VESTING_COMPLETE_PERIOD,
      presaleGoal: PRESALE_GOAL,
      presaleExchangeRate: PRESALE_EXCHANGE_RATE,
      percentSupplyOffered: PERCENT_SUPPLY_OFFERED,
      presalePeriod: PRESALE_PERIOD,
      reserve: test.reserve.address,
      beneficiary,
      percentFundingForBeneficiary: PERCENT_FUNDING_FOR_BENEFICIARY,
      startDate: 0,
      collaterals: [test.contributionToken.address, test.ant.address],
    }
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

    await deploy.deployVault(test, appManager)
    await deploy.deployReserve(test, appManager)
    await deploy.deployFundraising(test, appManager)
    await deploy.deployPresale(test, appManager)

    await deploy.setVaultPermissions(test, appManager)
    await deploy.setReservePermissions(test, appManager)
    await deploy.setFundraisingPermissions(test, appManager)
    await deploy.setPresalePermissions(test, appManager)
    await deploy.setTokenManagerPermissions(test, appManager)

    await deploy.initializeVault(test)
    await deploy.initializeReserve(test)
    await deploy.initializeFundraising(test)
    await deploy.initializeTokenManager(test)
  },
  deployDefaultSetup: async (test, appManager) => {
    await deploy.prepareDefaultSetup(test, appManager)
    return await deploy.initializePresale(test, deploy.defaultDeployParams(test, appManager))
  },
}

module.exports = deploy
