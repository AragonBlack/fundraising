/* eslint-disable no-undef */
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getBalance = require('@aragon/test-helpers/balance')(web3)
const assertEvent = require('@aragon/test-helpers/assertEvent')
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { hash } = require('eth-ens-namehash')
const sha3 = require('js-sha3').keccak_256

const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}

const assertExternalEvent = (tx, eventName, instances = 1) => {
  const events = tx.receipt.logs.filter(l => {
    return l.topics[0] == '0x' + sha3(eventName)
  })
  assert.equal(events.length, instances, `'${eventName}' event should have been fired ${instances} times`)
  return events
}

// const sha3 = require('js-sha3').keccak_256
// ...

// const tx = await instance.someFunction(();
// let event = tx.receipt.logs.some(l => { return l.topics[0] == '0x' + sha3("Stored()") });
// assert.ok(event, "Stored event not emitted");

const getTimestamp = receipt => {
  return web3.eth.getBlock(receipt.receipt.blockNumber).timestamp
}

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const TokenManager = artifacts.require('TokenManager')
const Vault = artifacts.require('Vault.sol')
const Pool = artifacts.require('Pool')
const Tap = artifacts.require('Tap.sol')
const Formula = artifacts.require('BancorFormula.sol')
const BancorCurve = artifacts.require('BancorCurve')
const ApiaryController = artifacts.require('ApiaryController.sol')

const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')
const ForceSendETH = artifacts.require('ForceSendETH')

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

contract('ApiaryController app', accounts => {
  let factory, dao, acl, tmBase, vBase, pBase, tBase, bcBase, acBase, token1, token2, token3
  let token, tokenManager, vault, pool, tap, formula, marketMaker, apiary

  let ETH,
    APP_MANAGER_ROLE,
    TM_MINT_ROLE,
    TM_BURN_ROLE,
    POOL_TRANSFER_ROLE,
    MM_ADD_COLLATERAL_TOKEN_ROLE,
    MM_UPDATE_RESERVE_RATIO_ROLE,
    MM_CREATE_BUY_ORDER_ROLE,
    MM_CREATE_SELL_ORDER_ROLE,
    TAP_ADD_TOKEN_TAP_ROLE,
    TAP_UPDATE_TOKEN_TAP_ROLE,
    TAP_WITHDRAW_ROLE,
    CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE,
    CONTROLLER_UPDATE_RESERVE_RATIO_ROLE,
    CONTROLLER_UPDATE_TOKEN_TAP_ROLE,
    CONTROLLER_CREATE_BUY_ORDER_ROLE,
    CONTROLLER_CREATE_SELL_ORDER_ROLE

  // let UPDATE_VAULT_ROLE, UPDATE_POOL_ROLE, ADD_TOKEN_TAP_ROLE, REMOVE_TOKEN_TAP_ROLE, UPDATE_TOKEN_TAP_ROLE, WITHDRAW_ROLE, TRANSFER_ROLE

  const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
  const VAULT_ID = hash('vault.aragonpm.eth')
  const POOL_ID = hash('pool.aragonpm.eth')
  const TAP_ID = hash('tap.aragonpm.eth')
  const BANCOR_CURVE_ID = hash('bancor-curve.aragonpm.eth')
  const APIARY_CONTROLLER_ID = hash('apiary-controller.aragonpm.eth')

  const INITIAL_ETH_BALANCE = 500
  const INITIAL_TOKEN_BALANCE = 1000
  const MAX_MONTHLY_TAP_INCREASE_RATE = 50 * Math.pow(10, 16)

  const VIRTUAL_SUPPLIES = [2, 3, 4]
  const VIRTUAL_BALANCES = [1, 3, 3]
  const RESERVE_RATIOS = [200000, 300000, 500000]

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  const initialize = async _ => {
    // DAO
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = await ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
    // token
    token = await MiniMeToken.new(NULL_ADDRESS, NULL_ADDRESS, 0, 'Bond', 18, 'BON', false)
    // token manager
    const tmReceipt = await dao.newAppInstance(TOKEN_MANAGER_ID, tmBase.address, '0x', false)
    tokenManager = await TokenManager.at(getEvent(tmReceipt, 'NewAppProxy', 'proxy'))
    // vault
    const vReceipt = await dao.newAppInstance(VAULT_ID, vBase.address, '0x', false)
    vault = await Vault.at(getEvent(vReceipt, 'NewAppProxy', 'proxy'))
    // pool
    const pReceipt = await dao.newAppInstance(POOL_ID, pBase.address, '0x', false)
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
    // tap
    const tReceipt = await dao.newAppInstance(TAP_ID, tBase.address, '0x', false)
    tap = await Tap.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))
    // bancor market-maker
    const bcReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bcBase.address, '0x', false)
    marketMaker = await BancorCurve.at(getEvent(bcReceipt, 'NewAppProxy', 'proxy'))
    // apiary controller
    const acReceipt = await dao.newAppInstance(APIARY_CONTROLLER_ID, acBase.address, '0x', false)
    apiary = await ApiaryController.at(getEvent(acReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(marketMaker.address, tokenManager.address, TM_MINT_ROLE, root, { from: root })
    await acl.createPermission(marketMaker.address, tokenManager.address, TM_BURN_ROLE, root, { from: root })
    await acl.createPermission(marketMaker.address, pool.address, POOL_TRANSFER_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, tap.address, TAP_ADD_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, tap.address, TAP_UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, tap.address, TAP_WITHDRAW_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, marketMaker.address, MM_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, marketMaker.address, MM_UPDATE_RESERVE_RATIO_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, marketMaker.address, MM_CREATE_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(apiary.address, marketMaker.address, MM_CREATE_SELL_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, apiary.address, CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, apiary.address, CONTROLLER_UPDATE_RESERVE_RATIO_ROLE, root, { from: root })
    await acl.createPermission(authorized, apiary.address, CONTROLLER_UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, apiary.address, CONTROLLER_CREATE_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, apiary.address, CONTROLLER_CREATE_SELL_ORDER_ROLE, root, { from: root })
    // collaterals
    await forceSendETH(authorized, INITIAL_ETH_BALANCE)
    token1 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
    token2 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
    token3 = await TokenMock.new(unauthorized, INITIAL_TOKEN_BALANCE)
    // allowances
    await token1.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token2.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token3.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: unauthorized })
    // initializations
    await token.changeController(tokenManager.address)
    await tokenManager.initialize(token.address, true, 0)
    await vault.initialize()
    await pool.initialize()
    await tap.initialize(vault.address, pool.address, MAX_MONTHLY_TAP_INCREASE_RATE)
    await marketMaker.initialize(apiary.address, tokenManager.address, formula.address, 1)
    await apiary.initialize(marketMaker.address, tap.address, pool.address)
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
    // base contracts
    tmBase = await TokenManager.new()
    vBase = await Vault.new()
    pBase = await Pool.new()
    tBase = await Tap.new()
    formula = await Formula.new()
    bcBase = await BancorCurve.new()
    acBase = await ApiaryController.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TM_MINT_ROLE = await tmBase.MINT_ROLE()
    TM_BURN_ROLE = await tmBase.BURN_ROLE()
    POOL_TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
    TAP_ADD_TOKEN_TAP_ROLE = await tBase.ADD_TOKEN_TAP_ROLE()
    TAP_UPDATE_TOKEN_TAP_ROLE = await tBase.UPDATE_TOKEN_TAP_ROLE()
    TAP_WITHDRAW_ROLE = await tBase.WITHDRAW_ROLE()
    MM_UPDATE_RESERVE_RATIO_ROLE = await bcBase.UPDATE_RESERVE_RATIO_ROLE()
    MM_ADD_COLLATERAL_TOKEN_ROLE = await bcBase.ADD_COLLATERAL_TOKEN_ROLE()
    MM_CREATE_BUY_ORDER_ROLE = await bcBase.CREATE_BUY_ORDER_ROLE()
    MM_CREATE_SELL_ORDER_ROLE = await bcBase.CREATE_SELL_ORDER_ROLE()
    CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE = await acBase.ADD_COLLATERAL_TOKEN_ROLE()
    CONTROLLER_UPDATE_RESERVE_RATIO_ROLE = await acBase.UPDATE_RESERVE_RATIO_ROLE()
    CONTROLLER_UPDATE_TOKEN_TAP_ROLE = await acBase.UPDATE_TOKEN_TAP_ROLE()
    CONTROLLER_CREATE_BUY_ORDER_ROLE = await acBase.CREATE_BUY_ORDER_ROLE()
    CONTROLLER_CREATE_SELL_ORDER_ROLE = await acBase.CREATE_SELL_ORDER_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  // context('> #initialize', () => {
  //   context('> initialization parameters are correct', () => {
  //     it('it should initialize contract', async () => {
  //       assert.equal(await apiary.tap(), tap.address)
  //       assert.equal(await apiary.curve(), marketMaker.address)
  //       assert.equal(await apiary.pool(), pool.address)
  //     })
  //   })

  //   context('> initialization parameters are not correct', () => {
  //     it('it should revert', async () => {})
  //   })

  //   it('it should revert on re-initialization', async () => {
  //     await assertRevert(() => apiary.initialize(marketMaker.address, tap.address, pool.address, { from: root }))
  //   })
  // })

  // context('> #addCollateralToken', () => {
  //   context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should add collateral token', async () => {
  //       const receipt1 = await apiary.addCollateralToken(ETH, 1, 2, 200000, 10, { from: authorized })
  //       const receipt2 = await apiary.addCollateralToken(token1.address, 2, 1, 300000, 5, { from: authorized })

  //       assertExternalEvent(receipt1, 'AddCollateralToken(address,uint256,uint256,uint32)')
  //       assertExternalEvent(receipt1, 'AddTokenTap(address,uint256)')
  //       assertExternalEvent(receipt2, 'AddCollateralToken(address,uint256,uint256,uint32)')
  //       assertExternalEvent(receipt2, 'AddTokenTap(address,uint256)')
  //     })
  //   })

  //   context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() => apiary.addCollateralToken(ETH, 1, 2, 200000, 10, { from: unauthorized }))
  //       await assertRevert(() => apiary.addCollateralToken(token1.address, 2, 1, 300000, 5, { from: unauthorized }))
  //     })
  //   })
  // })

  // context('> #updateTokenTap', () => {
  //   context('> sender has UPDATE_TOKEN_TAP_ROLE', () => {
  //     it('it should update token tap', async () => {
  //       await apiary.addCollateralToken(ETH, 1, 2, 200000, 10, { from: authorized })
  //       await apiary.addCollateralToken(token1.address, 2, 1, 300000, 5, { from: authorized })
  //       await timeTravel(2592000) // 1 month = 2592000 seconds

  //       const receipt1 = await apiary.updateTokenTap(ETH, 14, { from: authorized })
  //       const receipt2 = await apiary.updateTokenTap(token1.address, 7, { from: authorized })

  //       assertExternalEvent(receipt1, 'UpdateTokenTap(address,uint256)')
  //       assertExternalEvent(receipt2, 'UpdateTokenTap(address,uint256)')
  //     })
  //   })

  //   context('> sender does not have UPDATE_TOKEN_TAP_ROLE', () => {
  //     it('it should revert', async () => {
  //       await apiary.addCollateralToken(ETH, 1, 2, 200000, 10, { from: authorized })
  //       await apiary.addCollateralToken(token1.address, 2, 1, 300000, 5, { from: authorized })
  //       await timeTravel(2592000) // 1 month = 2592000 seconds

  //       await assertRevert(() => apiary.updateTokenTap(ETH, 14, { from: unauthorized }))
  //       await assertRevert(() => apiary.updateTokenTap(token1.address, 7, { from: unauthorized }))
  //     })
  //   })
  // })
})
