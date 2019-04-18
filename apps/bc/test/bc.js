/* eslint-disable no-undef */
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getBalance = require('@aragon/test-helpers/balance')(web3)
const assertEvent = require('@aragon/test-helpers/assertEvent')
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { hash } = require('eth-ens-namehash')

const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}
const getTimestamp = receipt => {
  return web3.eth.getBlock(receipt.receipt.blockNumber).timestamp
}

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const TokenManager = artifacts.require('TokenManager')
const Pool = artifacts.require('Pool')
const Controller = artifacts.require('SimpleMarketMakerController')
const Formula = artifacts.require('BancorFormula.sol')
const BancorCurve = artifacts.require('BancorCurve')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')
const ForceSendETH = artifacts.require('ForceSendETH')

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'


contract('BancorCurve app', accounts => {
  let factory, dao, acl, token, pBase, cBase, bBase, tBase, pool, tokenManager, controller, formula, curve, token1, token2, token3
  let ETH, APP_MANAGER_ROLE, MINT_ROLE, BURN_ROLE, CREATE_BUY_ORDER_ROLE, CREATE_SELL_ORDER_ROLE, TRANSFER_ROLE
  
  // let UPDATE_VAULT_ROLE, UPDATE_POOL_ROLE, ADD_TOKEN_TAP_ROLE, REMOVE_TOKEN_TAP_ROLE, UPDATE_TOKEN_TAP_ROLE, WITHDRAW_ROLE, TRANSFER_ROLE

  const POOL_ID = hash('pool.aragonpm.eth')
  const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
  const CONTROLLER_ID = hash('controller.aragonpm.eth')
  const BANCOR_CURVE_ID = hash('vault.aragonpm.eth')
  
  const INITIAL_ETH_BALANCE = 500
  const INITIAL_TOKEN_BALANCE = 1000

  const VIRTUAL_SUPPLIES = [2, 3, 4]
  const VIRTUAL_BALANCES = [1, 2, 3]
  const RESERVE_RATIOS = [200000, 300000, 500000]

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  // bytes32 public constant MINT_ROLE = keccak256("MINT_ROLE");
  // bytes32 public constant ISSUE_ROLE = keccak256("ISSUE_ROLE");
  // bytes32 public constant ASSIGN_ROLE = keccak256("ASSIGN_ROLE");
  // bytes32 public constant REVOKE_VESTINGS_ROLE = keccak256("REVOKE_VESTINGS_ROLE");
  // bytes32 public constant BURN_ROLE = keccak256("BURN_ROLE");

//   function initialize(
//     MiniMeToken _token,
//     bool _transferable,
//     uint256 _maxAccountTokens
// )

  const initialize = async _ => {
    // DAO
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = await ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
    // token
    token = await MiniMeToken.new(NULL_ADDRESS, NULL_ADDRESS, 0, 'Bond', 18, 'BON', false)
    // pool
    const pReceipt = await dao.newAppInstance(POOL_ID, pBase.address, '0x', false)
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
    // market maker controller
    const cReceipt = await dao.newAppInstance(CONTROLLER_ID, cBase.address, '0x', false)
    controller = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))
    // token manager
    const tReceipt = await dao.newAppInstance(TOKEN_MANAGER_ID, tBase.address, '0x', false)
    tokenManager = await TokenManager.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))
    // bancor-curve
    const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
    curve = await BancorCurve.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(curve.address, pool.address, TRANSFER_ROLE, root, { from: root })
    await acl.createPermission(curve.address, tokenManager.address, MINT_ROLE, root, { from: root })
    await acl.createPermission(curve.address, tokenManager.address, BURN_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, CREATE_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, CREATE_SELL_ORDER_ROLE, root, { from: root })
    // collaterals
    await forceSendETH(authorized, INITIAL_ETH_BALANCE)
    token1 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
    token2 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
    token3 = await TokenMock.new(unauthorized, INITIAL_TOKEN_BALANCE)
    // allowances
    await token1.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token2.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token3.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: unauthorized })
    // initializations
    await token.changeController(tokenManager.address)
    await tokenManager.initialize(token.address, true, 0)
    await pool.initialize()
    await controller.initialize(pool.address)
    await curve.initialize(controller.address, tokenManager.address, formula.address, 1, [ETH, token1.address, token2.address], VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, RESERVE_RATIOS)    
  }

  const forceSendETH = async (to, value) => {
    // Using this contract ETH will be send by selfdestruct which always succeeds
    const forceSend = await ForceSendETH.new()
    return forceSend.sendByDying(to, { value })
  }

  before(async () => {
    // factory
    const kBase = await Kernel.new(true) // petrify immediately
    const aBase = await ACL.new()
    const rFact = await EVMScriptRegistryFactory.new()
    factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)
    // formula
    formula = await Formula.new()
    // base contracts
    pBase = await Pool.new()
    cBase = await Controller.new()
    tBase = await TokenManager.new()
    bBase = await BancorCurve.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
    MINT_ROLE = await tBase.MINT_ROLE()
    BURN_ROLE = await tBase.BURN_ROLE()
    CREATE_BUY_ORDER_ROLE = await bBase.CREATE_BUY_ORDER_ROLE()
    CREATE_SELL_ORDER_ROLE = await bBase.CREATE_SELL_ORDER_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  context('> #initialize', () => {
    context('> initialization parameters are correct', () => {
      it('it should initialize contract', async () => {
        assert.equal(await curve.pool(), pool.address)
        assert.equal(await curve.token(), token.address)
        assert.equal(await token.transfersEnabled(), true)
        assert.equal(await curve.batchBlocks(), 1)
        assert.equal(await curve.collateralTokensLength(), 3)
        assert.equal(await curve.collateralTokens(1), ETH)
        assert.equal(await curve.collateralTokens(2), token1.address)
        assert.equal(await curve.collateralTokens(3), token2.address)
        assert.equal(await curve.isCollateralToken(ETH), true)
        assert.equal(await curve.isCollateralToken(token1.address), true)
        assert.equal(await curve.isCollateralToken(token2.address), true)
        assert.equal(await curve.virtualSupplies(ETH), VIRTUAL_SUPPLIES[0])
        assert.equal(await curve.virtualSupplies(token1.address), VIRTUAL_SUPPLIES[1])
        assert.equal(await curve.virtualSupplies(token2.address), VIRTUAL_SUPPLIES[2])
        assert.equal(await curve.virtualBalances(ETH), VIRTUAL_BALANCES[0])
        assert.equal(await curve.virtualBalances(token1.address), VIRTUAL_BALANCES[1])
        assert.equal(await curve.virtualBalances(token2.address), VIRTUAL_BALANCES[2])
        assert.equal(await curve.reserveRatios(ETH), RESERVE_RATIOS[0])
        assert.equal(await curve.reserveRatios(token1.address), RESERVE_RATIOS[1])
        assert.equal(await curve.reserveRatios(token2.address), RESERVE_RATIOS[2])
      })
    })

    context('> initialization parameters are not correct', () => {
      it('it should revert', async () => {
  
      })
    })

    it('it should revert on re-initialization', async () => {
      await assertRevert(() => curve.initialize(controller.address, tokenManager.address, formula.address, 1, [ETH, token1.address, token2.address], VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, RESERVE_RATIOS, { from: root }))
    })
  })

  context('> #createBuyOrder', () => {
    context('> sender has CREATE_BUY_ORDER_ROLE', () => {
      context('> and collateral is whitelisted', () => {
        context('> and value is not zero', () => {
          it('it should create buy order', async () => {
            const receipt = await curve.createBuyOrder(authorized, token1.address, 10, { from: authorized })

            assertEvent(receipt, 'NewBuyOrder')
            // tons of others assert stuff here
          })
        })

        context('> but value is zero', () => {
          it('it should revert', async () => {
            await assertRevert(() => curve.createBuyOrder(authorized, token1.address, 0, { from: authorized }))
          })
        })
      })
      context('> but collateral is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
          
          await assertRevert(() => curve.createBuyOrder(authorized, unlisted.address, 10, { from: authorized }))
        })
      })

    })
    context('> sender does not have CREATE_BUY_ORDER_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => curve.createBuyOrder(unauthorized, token3.address, 10, { from: unauthorized }))
      })
    })
  })

})
