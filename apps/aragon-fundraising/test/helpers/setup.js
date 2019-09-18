const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const TokenManager = artifacts.require('TokenManager')
const MiniMeToken = artifacts.require('MiniMeToken')
const Controller = artifacts.require('AragonFundraisingController')
const Presale = artifacts.require('PresaleMock')
const MarketMaker = artifacts.require('BatchedBancorMarketMaker')
const Formula = artifacts.require('BancorFormula')
const Agent = artifacts.require('Agent')
const Vault = artifacts.require('Vault')
const Tap = artifacts.require('Tap')
const TokenMock = artifacts.require('TokenMock')

const {
  ZERO_ADDRESS,
  ETH,
  INITIAL_COLLATERAL_BALANCE,
  PRESALE_GOAL,
  PRESALE_PERIOD,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PERCENT_SUPPLY_OFFERED,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  VIRTUAL_SUPPLIES,
  VIRTUAL_BALANCES,
  RESERVE_RATIOS,
  SLIPPAGES,
  BUY_FEE_PCT,
  SELL_FEE_PCT,
  RATES,
  FLOORS,
  BATCH_BLOCKS,
  MAXIMUM_TAP_RATE_INCREASE_PCT,
  MAXIMUM_TAP_FLOOR_DECREASE_PCT,
} = require('@ablack/fundraising-shared-test-helpers/constants')

const { hash } = require('eth-ens-namehash')
const getProxyAddress = require('@ablack/fundraising-shared-test-helpers/getProxyAddress')

const setup = {
  ids: {
    controller: hash('aragon-fundraising.aragonpm.eth'),
    tokenManager: hash('token-manager.aragonpm.eth'),
    presale: hash('presale.aragonpm.eth'),
    marketMaker: hash('batched-bancor-market-maker.aragonpm.eth'),
    agent: hash('agent.aragonpm.eth'),
    vault: hash('vault.aragonpm.eth'),
    tap: hash('tap.aragonpm.eth'),
  },
  deploy: {
    factory: async ctx => {
      const kBase = await Kernel.new(true) // petrify immediately
      const aBase = await ACL.new()
      const rFact = await EVMScriptRegistryFactory.new()

      ctx.factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)
      ctx.roles.APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    },
    base: async ctx => {
      ctx.base = ctx.base || {}

      ctx.base.controller = await Controller.new()
      ctx.base.tokenManager = await TokenManager.new()
      ctx.base.presale = await Presale.new()
      ctx.base.marketMaker = await MarketMaker.new()
      ctx.base.reserve = await Agent.new()
      ctx.base.vault = await Vault.new()
      ctx.base.tap = await Tap.new()
    },
    formula: async ctx => {
      ctx.formula = await Formula.new()
    },
    token: async (ctx, root) => {
      ctx.token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Bond', 18, 'BON', false, { from: root })
    },
    collaterals: async (ctx, user) => {
      ctx.collaterals = ctx.collaterals || {}
      ctx.collaterals.dai = await TokenMock.new(user, INITIAL_COLLATERAL_BALANCE)
      ctx.collaterals.ant = await TokenMock.new(user, INITIAL_COLLATERAL_BALANCE)
    },
    dao: async (ctx, root) => {
      const receipt = await ctx.factory.newDAO(root)

      ctx.dao = Kernel.at(receipt.logs.filter(l => l.event === 'DeployDAO')[0].args.dao)
      ctx.acl = ACL.at(await ctx.dao.acl())

      await ctx.acl.createPermission(root, ctx.dao.address, ctx.roles.APP_MANAGER_ROLE, root, { from: root })
    },
    infrastructure: async ctx => {
      ctx.roles = ctx.roles || {}

      await setup.deploy.factory(ctx)
      await setup.deploy.base(ctx)
      await setup.deploy.formula(ctx)
    },
    organization: async (ctx, root, user) => {
      await setup.deploy.token(ctx, root)
      await setup.deploy.collaterals(ctx, user)
      await setup.deploy.dao(ctx, root)
      await setup.install.all(ctx, root)
      await setup.initialize.all(ctx, root, user)
      await setup.setPermissions.all(ctx, root, user)
      await setup.setCollaterals(ctx, root, user)
    },
  },
  install: {
    controller: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.controller, ctx.base.controller.address, '0x', false, { from: root })

      ctx.controller = await Controller.at(getProxyAddress(receipt))
    },
    tokenManager: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.tokenManager, ctx.base.tokenManager.address, '0x', false, { from: root })

      ctx.tokenManager = await TokenManager.at(getProxyAddress(receipt))
    },
    presale: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.presale, ctx.base.presale.address, '0x', false, { from: root })

      ctx.presale = await Presale.at(getProxyAddress(receipt))
    },
    marketMaker: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.marketMaker, ctx.base.marketMaker.address, '0x', false, { from: root })

      ctx.marketMaker = await MarketMaker.at(getProxyAddress(receipt))
    },
    reserve: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.agent, ctx.base.reserve.address, '0x', false, { from: root })

      ctx.reserve = await Agent.at(getProxyAddress(receipt))
    },
    vault: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.vault, ctx.base.vault.address, '0x', false, { from: root })

      ctx.vault = await Vault.at(getProxyAddress(receipt))
    },
    tap: async (ctx, root) => {
      const receipt = await ctx.dao.newAppInstance(setup.ids.tap, ctx.base.tap.address, '0x', false, { from: root })

      ctx.tap = await Tap.at(getProxyAddress(receipt))
    },

    all: async (ctx, root) => {
      await setup.install.controller(ctx, root)
      await setup.install.tokenManager(ctx, root)
      await setup.install.presale(ctx, root)
      await setup.install.marketMaker(ctx, root)
      await setup.install.reserve(ctx, root)
      await setup.install.vault(ctx, root)
      await setup.install.tap(ctx, root)
    },
  },
  initialize: {
    controller: async (ctx, root) => {
      await ctx.controller.initialize(ctx.presale.address, ctx.marketMaker.address, ctx.reserve.address, ctx.tap.address, { from: root })
    },
    tokenManager: async (ctx, root) => {
      await ctx.token.changeController(ctx.tokenManager.address, { from: root })
      await ctx.tokenManager.initialize(ctx.token.address, true, 0, { from: root })
    },
    presale: async (ctx, root) => {
      await ctx.presale.initialize(
        ctx.controller.address,
        ctx.tokenManager.address,
        ctx.reserve.address,
        ctx.vault.address,
        ctx.collaterals.dai.address,
        RESERVE_RATIOS[0],
        PRESALE_GOAL,
        PRESALE_PERIOD,
        VESTING_CLIFF_PERIOD,
        VESTING_COMPLETE_PERIOD,
        PERCENT_SUPPLY_OFFERED,
        PERCENT_FUNDING_FOR_BENEFICIARY,
        0,
        [ctx.collaterals.dai.address],
        { from: root }
      )
    },
    marketMaker: async (ctx, root) => {
      await ctx.marketMaker.initialize(
        ctx.controller.address,
        ctx.tokenManager.address,
        ctx.formula.address,
        ctx.reserve.address,
        ctx.vault.address,
        BATCH_BLOCKS,
        BUY_FEE_PCT,
        SELL_FEE_PCT,
        { from: root }
      )
    },
    reserve: async (ctx, root) => {
      await ctx.reserve.initialize({ from: root })
    },
    vault: async (ctx, root) => {
      await ctx.vault.initialize({ from: root })
    },
    tap: async (ctx, root) => {
      await ctx.tap.initialize(
        ctx.controller.address,
        ctx.reserve.address,
        ctx.vault.address,
        BATCH_BLOCKS,
        MAXIMUM_TAP_RATE_INCREASE_PCT,
        MAXIMUM_TAP_FLOOR_DECREASE_PCT,
        { from: root }
      )
    },
    all: async (ctx, root, user) => {
      await setup.initialize.tokenManager(ctx, root)
      await setup.initialize.vault(ctx, root)
      await setup.initialize.reserve(ctx, root)
      await setup.initialize.presale(ctx, root)
      await setup.initialize.marketMaker(ctx, root)
      await setup.initialize.tap(ctx, root)
      await setup.initialize.controller(ctx, root)
    },
  },
  setPermissions: {
    controller: async (ctx, root, user) => {
      ctx.roles.controller = ctx.roles.controller || {}
      ctx.roles.controller.UPDATE_BENEFICIARY_ROLE = await ctx.base.controller.UPDATE_BENEFICIARY_ROLE()
      ctx.roles.controller.UPDATE_FEES_ROLE = await ctx.base.controller.UPDATE_FEES_ROLE()
      ctx.roles.controller.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE = await ctx.base.controller.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE()
      ctx.roles.controller.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = await ctx.base.controller.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE()
      ctx.roles.controller.ADD_COLLATERAL_TOKEN_ROLE = await ctx.base.controller.ADD_COLLATERAL_TOKEN_ROLE()
      ctx.roles.controller.REMOVE_COLLATERAL_TOKEN_ROLE = await ctx.base.controller.REMOVE_COLLATERAL_TOKEN_ROLE()
      ctx.roles.controller.UPDATE_COLLATERAL_TOKEN_ROLE = await ctx.base.controller.UPDATE_COLLATERAL_TOKEN_ROLE()
      ctx.roles.controller.UPDATE_TOKEN_TAP_ROLE = await ctx.base.controller.UPDATE_TOKEN_TAP_ROLE()
      ctx.roles.controller.RESET_TOKEN_TAP_ROLE = await ctx.base.controller.RESET_TOKEN_TAP_ROLE()
      ctx.roles.controller.OPEN_PRESALE_ROLE = await ctx.base.controller.OPEN_PRESALE_ROLE()
      ctx.roles.controller.OPEN_TRADING_ROLE = await ctx.base.controller.OPEN_TRADING_ROLE()
      ctx.roles.controller.CONTRIBUTE_ROLE = await ctx.base.controller.CONTRIBUTE_ROLE()
      ctx.roles.controller.OPEN_BUY_ORDER_ROLE = await ctx.base.controller.OPEN_BUY_ORDER_ROLE()
      ctx.roles.controller.OPEN_SELL_ORDER_ROLE = await ctx.base.controller.OPEN_SELL_ORDER_ROLE()
      ctx.roles.controller.WITHDRAW_ROLE = await ctx.base.controller.WITHDRAW_ROLE()

      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.UPDATE_BENEFICIARY_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.UPDATE_FEES_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.REMOVE_COLLATERAL_TOKEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.UPDATE_COLLATERAL_TOKEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.UPDATE_TOKEN_TAP_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.presale.address, ctx.controller.address, ctx.roles.controller.RESET_TOKEN_TAP_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.OPEN_PRESALE_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.presale.address, ctx.controller.address, ctx.roles.controller.OPEN_TRADING_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.CONTRIBUTE_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.OPEN_BUY_ORDER_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.OPEN_SELL_ORDER_ROLE, root, { from: root })
      await ctx.acl.createPermission(user, ctx.controller.address, ctx.roles.controller.WITHDRAW_ROLE, root, { from: root })

      // for tests purposes only
      await ctx.acl.grantPermission(root, ctx.controller.address, ctx.roles.controller.ADD_COLLATERAL_TOKEN_ROLE, { from: root })
      await ctx.acl.grantPermission(user, ctx.controller.address, ctx.roles.controller.RESET_TOKEN_TAP_ROLE, { from: root })
      await ctx.acl.grantPermission(user, ctx.controller.address, ctx.roles.controller.OPEN_TRADING_ROLE, { from: root })
    },
    tokenManager: async (ctx, root) => {
      ctx.roles.tokenManager = ctx.roles.tokenManager || {}
      ctx.roles.tokenManager.MINT_ROLE = await ctx.base.tokenManager.MINT_ROLE()
      ctx.roles.tokenManager.BURN_ROLE = await ctx.base.tokenManager.BURN_ROLE()
      ctx.roles.tokenManager.ISSUE_ROLE = await ctx.base.tokenManager.ISSUE_ROLE()
      ctx.roles.tokenManager.ASSIGN_ROLE = await ctx.base.tokenManager.ASSIGN_ROLE()
      ctx.roles.tokenManager.REVOKE_VESTINGS_ROLE = await ctx.base.tokenManager.REVOKE_VESTINGS_ROLE()

      await ctx.acl.createPermission(ctx.marketMaker.address, ctx.tokenManager.address, ctx.roles.tokenManager.MINT_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.marketMaker.address, ctx.tokenManager.address, ctx.roles.tokenManager.BURN_ROLE, root, { from: root })
      await ctx.acl.grantPermission(ctx.presale.address, ctx.tokenManager.address, ctx.roles.tokenManager.BURN_ROLE, { from: root })
      await ctx.acl.createPermission(ctx.presale.address, ctx.tokenManager.address, ctx.roles.tokenManager.ISSUE_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.presale.address, ctx.tokenManager.address, ctx.roles.tokenManager.ASSIGN_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.presale.address, ctx.tokenManager.address, ctx.roles.tokenManager.REVOKE_VESTINGS_ROLE, root, { from: root })
    },
    presale: async (ctx, root) => {
      ctx.roles.presale = ctx.roles.presale || {}
      ctx.roles.presale.OPEN_ROLE = await ctx.base.presale.OPEN_ROLE()
      ctx.roles.presale.CONTRIBUTE_ROLE = await ctx.base.presale.CONTRIBUTE_ROLE()

      await ctx.acl.createPermission(ctx.controller.address, ctx.presale.address, ctx.roles.presale.OPEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.presale.address, ctx.roles.presale.CONTRIBUTE_ROLE, root, { from: root })
    },
    marketMaker: async (ctx, root) => {
      ctx.roles.marketMaker = ctx.roles.marketMaker || {}
      ctx.roles.marketMaker.OPEN_ROLE = await ctx.base.marketMaker.OPEN_ROLE()
      ctx.roles.marketMaker.UPDATE_BENEFICIARY_ROLE = await ctx.base.marketMaker.UPDATE_BENEFICIARY_ROLE()
      ctx.roles.marketMaker.UPDATE_FEES_ROLE = await ctx.base.marketMaker.UPDATE_FEES_ROLE()
      ctx.roles.marketMaker.ADD_COLLATERAL_TOKEN_ROLE = await ctx.base.marketMaker.ADD_COLLATERAL_TOKEN_ROLE()
      ctx.roles.marketMaker.REMOVE_COLLATERAL_TOKEN_ROLE = await ctx.base.marketMaker.REMOVE_COLLATERAL_TOKEN_ROLE()
      ctx.roles.marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE = await ctx.base.marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE()
      ctx.roles.marketMaker.OPEN_BUY_ORDER_ROLE = await ctx.base.marketMaker.OPEN_BUY_ORDER_ROLE()
      ctx.roles.marketMaker.OPEN_SELL_ORDER_ROLE = await ctx.base.marketMaker.OPEN_SELL_ORDER_ROLE()

      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.OPEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.UPDATE_BENEFICIARY_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.UPDATE_FEES_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.ADD_COLLATERAL_TOKEN_ROLE, root, {
        from: root,
      })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.REMOVE_COLLATERAL_TOKEN_ROLE, root, {
        from: root,
      })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE, root, {
        from: root,
      })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.OPEN_BUY_ORDER_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.marketMaker.address, ctx.roles.marketMaker.OPEN_SELL_ORDER_ROLE, root, { from: root })
    },
    reserve: async (ctx, root) => {
      ctx.roles.reserve = ctx.roles.reserve || {}
      ctx.roles.reserve.ADD_PROTECTED_TOKEN_ROLE = await ctx.base.reserve.ADD_PROTECTED_TOKEN_ROLE()
      ctx.roles.reserve.TRANSFER_ROLE = await ctx.base.reserve.TRANSFER_ROLE()

      await ctx.acl.createPermission(ctx.marketMaker.address, ctx.reserve.address, ctx.roles.reserve.TRANSFER_ROLE, root, { from: root })
      await ctx.acl.grantPermission(ctx.tap.address, ctx.reserve.address, ctx.roles.reserve.TRANSFER_ROLE, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.reserve.address, ctx.roles.reserve.ADD_PROTECTED_TOKEN_ROLE, root, { from: root })
    },
    vault: async (ctx, root) => {},
    tap: async (ctx, root) => {
      ctx.roles.tap = ctx.roles.tap || {}
      ctx.roles.tap.UPDATE_BENEFICIARY_ROLE = await ctx.base.tap.UPDATE_BENEFICIARY_ROLE()
      ctx.roles.tap.ADD_TAPPED_TOKEN_ROLE = await ctx.base.tap.ADD_TAPPED_TOKEN_ROLE()
      ctx.roles.tap.UPDATE_TAPPED_TOKEN_ROLE = await ctx.base.tap.UPDATE_TAPPED_TOKEN_ROLE()
      ctx.roles.tap.RESET_TAPPED_TOKEN_ROLE = await ctx.base.tap.RESET_TAPPED_TOKEN_ROLE()
      ctx.roles.tap.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE = await ctx.base.tap.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE()
      ctx.roles.tap.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = await ctx.base.tap.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE()
      ctx.roles.tap.WITHDRAW_ROLE = await ctx.base.tap.WITHDRAW_ROLE()

      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.UPDATE_BENEFICIARY_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.ADD_TAPPED_TOKEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.RESET_TAPPED_TOKEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.UPDATE_TAPPED_TOKEN_ROLE, root, { from: root })
      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE, root, {
        from: root,
      })
      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE, root, {
        from: root,
      })
      await ctx.acl.createPermission(ctx.controller.address, ctx.tap.address, ctx.roles.tap.WITHDRAW_ROLE, root, { from: root })
    },
    all: async (ctx, root, user) => {
      await setup.setPermissions.controller(ctx, root, user)
      await setup.setPermissions.tokenManager(ctx, root)
      await setup.setPermissions.presale(ctx, root)
      await setup.setPermissions.marketMaker(ctx, root)
      await setup.setPermissions.reserve(ctx, root)
      await setup.setPermissions.vault(ctx, root)
      await setup.setPermissions.tap(ctx, root)
    },
  },
  setCollaterals: async (ctx, root, user) => {
    await ctx.collaterals.dai.approve(ctx.presale.address, INITIAL_COLLATERAL_BALANCE, { from: user })
    await ctx.collaterals.dai.approve(ctx.marketMaker.address, INITIAL_COLLATERAL_BALANCE, { from: user })
    await ctx.collaterals.ant.approve(ctx.presale.address, INITIAL_COLLATERAL_BALANCE, { from: user })
    await ctx.collaterals.ant.approve(ctx.marketMaker.address, INITIAL_COLLATERAL_BALANCE, { from: user })

    await ctx.controller.addCollateralToken(ETH, VIRTUAL_SUPPLIES[0], VIRTUAL_BALANCES[0], RESERVE_RATIOS[0], SLIPPAGES[0], RATES[0], FLOORS[0], {
      from: root,
    })
    await ctx.controller.addCollateralToken(
      ctx.collaterals.dai.address,
      VIRTUAL_SUPPLIES[1],
      VIRTUAL_BALANCES[1],
      RESERVE_RATIOS[1],
      SLIPPAGES[1],
      RATES[1],
      FLOORS[1],
      {
        from: root,
      }
    )
  },
}

module.exports = setup
