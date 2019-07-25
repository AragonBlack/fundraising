/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const assertEvent = require('@aragon/test-helpers/assertEvent')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const getBalance = require('@aragon/test-helpers/balance')(web3)
const { hash } = require('eth-ens-namehash')
const Decimal = require('decimal.js')
const forEach = require('mocha-each')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const Controller = artifacts.require('SimpleMarketMakerController')
const TokenManager = artifacts.require('TokenManager')
const Pool = artifacts.require('Pool')
const Formula = artifacts.require('BancorFormula.sol')
const BancorMarketMaker = artifacts.require('BatchedBancorMarketMaker')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

const truffleConfig = require('@aragon/os/truffle-config')
const gasCost = new web3.BigNumber(truffleConfig.networks.rpc.gasPrice)

const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}

const getBuyOrderBatchId = receipt => {
  const event = receipt.logs.find(l => l.event === 'NewBuyOrder')
  return event.args.batchId
}

const getNewMetaBatchEvent = receipt => {
  return receipt.logs.find(l => l.event === 'NewMetaBatch').args
}

const getNewMetaBatchSupply = receipt => {
  const event = receipt.logs.find(l => l.event === 'NewMetaBatch')
  return event.args.supply
}

const getNewBatchEvent = receipt => {
  return receipt.logs.find(l => l.event === 'NewBatch').args
}

const getUpdatePricingEvent = receipt => {
  return receipt.logs.find(l => l.event === 'UpdatePricing').args
}

const getSellOrderBatchId = receipt => {
  const event = receipt.logs.find(l => l.event === 'NewSellOrder')
  return event.args.batchId.toNumber()
}

const randomVirtualSupply = () => {
  return Math.floor(Math.random() * 9999) + 1
}

const randomVirtualBalance = () => {
  return Math.floor(Math.random() * 9999) + 1
}

const randomReserveRatio = () => {
  return Math.floor(Math.random() * 999999) + 1
}

let BLOCKS_IN_BATCH

contract('BatchedBancorMarketMaker app', accounts => {
  let factory, dao, acl, cBase, tBase, pBase, bBase, token, tokenManager, controller, pool, formula, curve, token1, token2, collaterals
  let ETH,
    APP_MANAGER_ROLE,
    MINT_ROLE,
    BURN_ROLE,
    ADD_COLLATERAL_TOKEN_ROLE,
    UPDATE_COLLATERAL_TOKEN_ROLE,
    UPDATE_BENEFICIARY_ROLE,
    UPDATE_FORMULA_ROLE,
    UPDATE_FEES_ROLE,
    OPEN_BUY_ORDER_ROLE,
    OPEN_SELL_ORDER_ROLE,
    TRANSFER_ROLE

  const POOL_ID = hash('pool.aragonpm.eth')
  const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
  const CONTROLLER_ID = hash('controller.aragonpm.eth')
  const BANCOR_CURVE_ID = hash('vault.aragonpm.eth')

  const PPM = 1000000
  const PCT_BASE = 1000000000000000000

  const INITIAL_TOKEN_BALANCE = 10000 * Math.pow(10, 18) // 10000 DAIs or ANTs

  BLOCKS_IN_BATCH = 10
  const BUY_FEE_PERCENT = 100000000000000000 // 1%
  const SELL_FEE_PERCENT = 100000000000000000
  const MAXIMUM_SLIPPAGE = 10 * PCT_BASE // x10

  const VIRTUAL_SUPPLIES = [10 * Math.pow(10, 18), 100 * Math.pow(10, 18), 20]
  const VIRTUAL_BALANCES = [1 * Math.pow(10, 18), 1 * Math.pow(10, 18), 1]
  const RESERVE_RATIOS = [(PPM * 10) / 100, (PPM * 1) / 100, (PPM * 20) / 100]

  const root = accounts[0]
  const authorized = accounts[1]
  const authorized2 = accounts[2]
  const unauthorized = accounts[3]
  const beneficiary = accounts[4]

  const initialize = async _ => {
    // DAO
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = await ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
    // token
    token = await MiniMeToken.new(NULL_ADDRESS, NULL_ADDRESS, 0, 'Bond', 18, 'BON', false)
    // market maker controller
    const cReceipt = await dao.newAppInstance(CONTROLLER_ID, cBase.address, '0x', false)
    controller = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))
    // token manager
    const tReceipt = await dao.newAppInstance(TOKEN_MANAGER_ID, tBase.address, '0x', false)
    tokenManager = await TokenManager.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))
    // pool
    const pReceipt = await dao.newAppInstance(POOL_ID, pBase.address, '0x', false)
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
    // bancor-curve
    const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
    curve = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(curve.address, tokenManager.address, MINT_ROLE, root, { from: root })
    await acl.createPermission(curve.address, tokenManager.address, BURN_ROLE, root, { from: root })
    await acl.createPermission(curve.address, pool.address, TRANSFER_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_FORMULA_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_FEES_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, OPEN_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, OPEN_SELL_ORDER_ROLE, root, { from: root })
    await acl.grantPermission(authorized2, curve.address, ADD_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_BENEFICIARY_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_FORMULA_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_FEES_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, OPEN_BUY_ORDER_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, OPEN_SELL_ORDER_ROLE, { from: root })
    // collaterals
    token1 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE * 2)
    token2 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE * 2)
    await token1.transfer(authorized2, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token2.transfer(authorized2, INITIAL_TOKEN_BALANCE, { from: authorized })
    collaterals = [ETH, token1.address]
    // allowances
    await token1.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token2.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token1.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized2 })
    await token2.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized2 })
    // initializations
    await token.changeController(tokenManager.address)
    await tokenManager.initialize(token.address, true, 0)
    await pool.initialize()
    await controller.initialize()
    await curve.initialize(
      controller.address,
      tokenManager.address,
      pool.address,
      beneficiary,
      formula.address,
      BLOCKS_IN_BATCH,
      BUY_FEE_PERCENT,
      SELL_FEE_PERCENT,
      MAXIMUM_SLIPPAGE
    )
    // end up initializing market maker
    await curve.addCollateralToken(ETH, VIRTUAL_SUPPLIES[0], VIRTUAL_BALANCES[0], RESERVE_RATIOS[0], { from: authorized })
    await curve.addCollateralToken(token1.address, VIRTUAL_SUPPLIES[1], VIRTUAL_BALANCES[1], RESERVE_RATIOS[1], { from: authorized })
    await curve.addCollateralToken(token2.address, VIRTUAL_SUPPLIES[2], VIRTUAL_BALANCES[2], RESERVE_RATIOS[2], { from: authorized })
    // make sure tests start at the beginning of a new batch
    await progressToNextBatch()
  }

  const purchaseReturn = (supply, balance, reserveRatio, amount) => {
    console.log(1 + amount / balance)
    console.log(reserveRatio / PPM - 1)
    return Math.floor(supply * (Math.pow(1 + amount / balance, reserveRatio / PPM) - 1))
  }

  const randomAmount = () => {
    return new web3.BigNumber(Math.floor(Math.random() * 3 * Math.pow(10, 18)) + 5)
  }

  const randomBigAmount = () => {
    return new web3.BigNumber(100 * Math.floor(Math.random() * 10) * Math.pow(10, 18))
  }

  const randomSmallAmount = () => {
    return new web3.BigNumber(Math.floor(Math.random() * 10 + 1) * Math.pow(10, 18))
  }

  const balance = async (collateral, address) => {
    if (collateral === ETH) {
      return web3.eth.getBalance(address)
    } else {
      const token = await TokenMock.at(collateral)
      return token.balanceOf(address)
    }
  }

  const computeAmountBeforeBuyFee = amountAfterFee => {
    amountAfterFee = new Decimal(amountAfterFee.toString(10))
    const amount = amountAfterFee.div(new Decimal(1).sub(new Decimal(BUY_FEE_PERCENT).div(PCT_BASE)))
    return new web3.BigNumber(amount.toString(10))
  }

  const computeBuyFee = amount => {
    amount = new web3.BigNumber(amount.toString(10))
    return amount
      .times(BUY_FEE_PERCENT)
      .div(PCT_BASE)
      .round(0)
  }

  const computeSellFee = amount => {
    amount = new web3.BigNumber(amount.toString(10))
    return amount
      .times(SELL_FEE_PERCENT)
      .div(PCT_BASE)
      .round(0)
  }

  const getBatch = async (batchNumber, collateralToken) => {
    let [initialized, supply, balance, reserveRatio, totalBuySpend, totalBuyReturn, totalSellSpend, totalSellReturn] = await curve.getBatch(
      batchNumber,
      collateralToken
    )
    return {
      initialized,
      supply,
      balance,
      reserveRatio,
      totalBuySpend,
      totalBuyReturn,
      totalSellSpend,
      totalSellReturn,
    }
  }

  const getCollateralToken = async collateral => {
    const [whitelisted, virtualSupply, virtualBalance, reserveRatio] = await curve.getCollateralToken(collateral)

    return { whitelisted, virtualSupply, virtualBalance, reserveRatio }
  }

  const openBuyOrder = async (buyer, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : buyer
    const value = collateral === ETH ? (opts && opts.value ? opts.value : amount) : 0
    const receipt = await curve.openBuyOrder(buyer, collateral, amount, { from, value })

    return receipt
  }

  const openSellOrder = async (seller, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : buyer
    const receipt = await curve.openSellOrder(seller, collateral, amount, { from })

    return receipt
  }

  const createAndClaimBuyOrder = async ({ address, collateralToken, amount, from }) => {
    from = from || address
    // create buy order
    let value = collateralToken === ETH ? amount : 0
    const receipt = await curve.createBuyOrder(address, collateralToken, amount, { from, value })
    const event = receipt.logs.find(l => l.event === 'NewBuyOrder')
    const batchId = event.args.batchId.toNumber()
    // move to next batch
    await increaseBlocks(BLOCKS_IN_BATCH)
    // clear batch
    await curve.clearBatches()
    // claim bonds
    printBuy(await curve.claimBuy(address, collateralToken, batchId))
    // return balance
    const balance = await token.balanceOf(address)

    return balance
  }

  const openAndClaimBuyOrder = async (buyer, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : buyer
    const value = collateral === ETH ? (opts && opts.value ? opts.value : amount) : 0

    const receipt = await curve.openBuyOrder(buyer, collateral, amount, { from, value })
    const batchId = getBuyOrderBatchId(receipt)

    await progressToNextBatch()
    await curve.claimBuyOrder(buyer, batchId, collateral, { from })

    return token.balanceOf(buyer)
  }

  const progressToNextBatch = async () => {
    let currentBlock = await blockNumber()
    let currentBatch = await curve.getCurrentBatchId()
    let blocksTilNextBatch = currentBatch.plus(BLOCKS_IN_BATCH).sub(currentBlock)
    await increaseBlocks(blocksTilNextBatch)
  }

  // const increaseBlocks = blocks => {
  //   return new Promise((resolve, reject) => {
  //     increaseBlock().then(() => {
  //       blocks -= 1
  //       if (blocks === 0) {
  //         resolve()
  //       } else {
  //         increaseBlocks(blocks).then(resolve)
  //       }
  //     })
  //   })
  // }

  // const increaseBlock = () => {
  //   return new Promise((resolve, reject) => {
  //     web3.currentProvider.sendAsync({ jsonrpc: '2.0', method: 'evm_mine', id: 12345 }, (err, result) => {
  //       if (err) reject(err)
  //       resolve(result)
  //     })
  //   })
  // }

  before(async () => {
    // factory
    const kBase = await Kernel.new(true) // petrify immediately
    const aBase = await ACL.new()
    const rFact = await EVMScriptRegistryFactory.new()
    factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)
    // formula
    formula = await Formula.new()
    // base contracts
    cBase = await Controller.new()
    tBase = await TokenManager.new()
    pBase = await Pool.new()
    bBase = await BancorMarketMaker.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
    MINT_ROLE = await tBase.MINT_ROLE()
    BURN_ROLE = await tBase.BURN_ROLE()
    ADD_COLLATERAL_TOKEN_ROLE = await bBase.ADD_COLLATERAL_TOKEN_ROLE()
    UPDATE_COLLATERAL_TOKEN_ROLE = await bBase.UPDATE_COLLATERAL_TOKEN_ROLE()
    UPDATE_BENEFICIARY_ROLE = await bBase.UPDATE_BENEFICIARY_ROLE()
    UPDATE_FORMULA_ROLE = await bBase.UPDATE_FORMULA_ROLE()
    UPDATE_FEES_ROLE = await bBase.UPDATE_FEES_ROLE()
    OPEN_BUY_ORDER_ROLE = await bBase.OPEN_BUY_ORDER_ROLE()
    OPEN_SELL_ORDER_ROLE = await bBase.OPEN_SELL_ORDER_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  // #region deploy
  // context('> #deploy', () => {
  //   it('> it should deploy', async () => {
  //     await BancorMarketMaker.new()
  //   })
  // })
  // #endregion

  // #region initialize
  // context('> #initialize', () => {
  //   context('> initialization parameters are correct', () => {
  //     it('it should initialize bancor market maker', async () => {
  //       assert.equal(await curve.controller(), controller.address)
  //       assert.equal(await curve.tokenManager(), tokenManager.address)
  //       assert.equal(await curve.token(), token.address)
  //       assert.equal(await curve.reserve(), pool.address)
  //       assert.equal(await curve.beneficiary(), beneficiary)
  //       assert.equal(await curve.formula(), formula.address)
  //       assert.equal(await curve.batchBlocks(), BLOCKS_IN_BATCH)
  //       assert.equal(await curve.buyFeePct(), BUY_FEE_PERCENT)
  //       assert.equal(await curve.sellFeePct(), SELL_FEE_PERCENT)
  //     })
  //   })

  //   context('> initialization parameters are not correct', () => {
  //     it('it should revert [controller is not a contract]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           authorized,
  //           tokenManager.address,
  //           pool.address,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           { from: root }
  //         )
  //       )
  //     })

  //     it('it should revert [token manager is not a contract]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           authorized,
  //           pool.address,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           { from: root }
  //         )
  //       )
  //     })

  //     it('it should revert [pool is not a contract]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           authorized,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           {
  //             from: root,
  //           }
  //         )
  //       )
  //     })

  //     it('it should revert [formula is not a contract]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           pool.address,
  //           beneficiary,
  //           authorized,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           {
  //             from: root,
  //           }
  //         )
  //       )
  //     })

  //     it('it should revert [batchBlocks is zero]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(controller.address, tokenManager.address, pool.address, beneficiary, formula.address, 0, BUY_FEE_PERCENT, SELL_FEE_PERCENT, {
  //           from: root,
  //         })
  //       )
  //     })

  //     it('it should revert [buy fee is not a percentage]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           pool.address,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           PCT_BASE,
  //           SELL_FEE_PERCENT,
  //           {
  //             from: root,
  //           }
  //         )
  //       )
  //     })

  //     it('it should revert [sell fee is not a percentage]', async () => {
  //       const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           pool.address,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           PCT_BASE,
  //           {
  //             from: root,
  //           }
  //         )
  //       )
  //     })
  //   })

  //   it('it should revert on re-initialization', async () => {
  //     assertRevert(() =>
  //       curve.initialize(
  //         controller.address,
  //         tokenManager.address,
  //         pool.address,
  //         beneficiary,
  //         formula.address,
  //         BLOCKS_IN_BATCH,
  //         BUY_FEE_PERCENT,
  //         SELL_FEE_PERCENT,
  //         { from: root }
  //       )
  //     )
  //   })
  // })
  // #endregion

  // #region addCollateralToken
  // context('> #addCollateralToken', () => {
  //   context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
  //     context('> and collateral token has not yet been added', () => {
  //       context('> and collateral token is ETH or ERC20 [i.e. contract]', () => {
  //         it('it should add collateral token', async () => {
  //           const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

  //           const virtualSupply = randomVirtualSupply()
  //           const virtualBalance = randomVirtualBalance()
  //           const reserveRatio = randomReserveRatio()

  //           const receipt = await curve.addCollateralToken(unlisted.address, virtualSupply, virtualBalance, reserveRatio, { from: authorized })
  //           const collateral = await getCollateralToken(unlisted.address)

  //           assertEvent(receipt, 'AddCollateralToken')
  //           assert.equal(collateral.whitelisted, true)
  //           assert.equal(collateral.virtualSupply.toNumber(), virtualSupply)
  //           assert.equal(collateral.virtualBalance.toNumber(), virtualBalance)
  //           assert.equal(collateral.reserveRatio.toNumber(), reserveRatio)
  //         })
  //       })

  //       context('> but collateral token is not ETH or ERC20 [i.e. contract]', () => {
  //         it('it should revert', async () => {
  //           await assertRevert(() =>
  //             curve.addCollateralToken(authorized, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: authorized })
  //           )
  //         })
  //       })
  //     })

  //     context('> but collateral token has already been added', () => {
  //       it('it should revert', async () => {
  //         await assertRevert(() => curve.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: authorized }))
  //       })
  //     })
  //   })

  //   context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should revert', async () => {
  //       const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

  //       await assertRevert(() =>
  //         curve.addCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: unauthorized })
  //       )
  //     })
  //   })
  // })
  // #endregion

  // #region updateCollateralToken
  // context('> #updateCollateralToken', () => {
  //   context('> sender has UPDATE_COLLATERAL_TOKEN_ROLE', () => {
  //     context('> and collateral token is whitelisted', () => {
  //       it('it should update collateral token', async () => {
  //         const virtualSupply = randomVirtualSupply()
  //         const virtualBalance = randomVirtualBalance()
  //         const reserveRatio = randomReserveRatio()

  //         const receipt = await curve.updateCollateralToken(token1.address, virtualSupply, virtualBalance, reserveRatio, { from: authorized })
  //         const collateral = await getCollateralToken(token1.address)

  //         assertEvent(receipt, 'UpdateCollateralToken')
  //         assert.equal(collateral.virtualSupply.toNumber(), virtualSupply)
  //         assert.equal(collateral.virtualBalance.toNumber(), virtualBalance)
  //         assert.equal(collateral.reserveRatio.toNumber(), reserveRatio)
  //       })
  //     })

  //     context('> but collateral token is not whitelisted', () => {
  //       it('it should revert', async () => {
  //         const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

  //         await assertRevert(() =>
  //           curve.updateCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: authorized })
  //         )
  //       })
  //     })
  //   })

  //   context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() =>
  //         curve.updateCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: unauthorized })
  //       )
  //     })
  //   })
  // })
  // #endregion

  // #region updateBeneficiary
  // context('> #updateBeneficiary', () => {
  //   context('> sender has UPDATE_BENEFICIARY_ROLE', () => {
  //     it('it should update beneficiary', async () => {
  //       const receipt = await curve.updateBeneficiary(root, { from: authorized })

  //       assertEvent(receipt, 'UpdateBeneficiary')
  //       assert.equal(await curve.beneficiary(), root)
  //     })
  //   })

  //   context('> sender does not have UPDATE_BENEFICIARY_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() => curve.updateBeneficiary(root, { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region updateFormula
  // context('> #updateFormula', () => {
  //   context('> sender has UPDATE_FORMULA_ROLE', () => {
  //     context('> and new formula is a contract', () => {
  //       it('it should update formula', async () => {
  //         const _formula = await Formula.new()
  //         const receipt = await curve.updateFormula(_formula.address, { from: authorized })

  //         assertEvent(receipt, 'UpdateFormula')
  //         assert.equal(await curve.formula(), _formula.address)
  //       })
  //     })

  //     context('> but new formula is not a contract', () => {
  //       it('it should revert', async () => {
  //         await assertRevert(() => curve.updateFormula(root, { from: authorized }))
  //       })
  //     })
  //   })

  //   context('> sender does not have UPDATE_FORMULA_ROLE', () => {
  //     it('it should revert', async () => {
  //       const _formula = await Formula.new()

  //       await assertRevert(() => curve.updateFormula(_formula.address, { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region updateFees
  // context('> #updateFees', () => {
  //   context('> sender has UPDATE_FEES_ROLE', () => {
  //     context('> and new fees are a percentage', () => {
  //       it('it should update fees', async () => {
  //         const receipt = await curve.updateFees(40, 50, { from: authorized })

  //         assertEvent(receipt, 'UpdateFees')
  //         assert.equal((await curve.buyFeePct()).toNumber(), 40)
  //         assert.equal((await curve.sellFeePct()).toNumber(), 50)
  //       })
  //     })

  //     context('> but new fees are not a percentage', () => {
  //       it('it should revert [buy fee is not a percentage]', async () => {
  //         await assertRevert(() => curve.updateFees(PCT_BASE + 1, 50, { from: authorized }))
  //       })

  //       it('it should revert [sell fee is not a percentage]', async () => {
  //         await assertRevert(() => curve.updateFees(40, PCT_BASE + 1, { from: authorized }))
  //       })
  //     })
  //   })

  //   context('> sender does not have UPDATE_FEES_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() => curve.updateFees(40, 50, { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region openBuyOrder
  // context('> #openBuyOrder', () => {
  //   forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
  //     const index = round === 'ETH' ? 0 : 1

  //     context('> sender has OPEN_BUY_ORDER_ROLE', () => {
  //       context('> and collateral is whitelisted', () => {
  //         context('> and value is not zero', () => {
  //           context('> and sender has sufficient funds', () => {
  //             context('> and order does not break maximum batch slippage', () => {
  //               it('it should initialize new meta-batch [when there is no previous meta-batch]', async () => {
  //                 const amount = randomSmallAmount()
  //                 const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })

  //                 assertEvent(receipt, 'NewMetaBatch')
  //                 const metaBatch = getNewMetaBatchEvent(receipt)

  //                 assert.isAbove(metaBatch.id.toNumber(), 0)
  //                 assert.equal(metaBatch.supply, 0)
  //               })

  //               it('it should initialize new meta-batch [when there are previous meta-batches]', async () => {
  //                 const amount1 = randomSmallAmount()
  //                 const fee = computeBuyFee(amount1)
  //                 const supply = await formula.calculatePurchaseReturn(
  //                   VIRTUAL_SUPPLIES[index],
  //                   VIRTUAL_BALANCES[index],
  //                   RESERVE_RATIOS[index],
  //                   amount1.minus(fee)
  //                 )

  //                 const receipt1 = await openBuyOrder(authorized, collaterals[index], amount1, { from: authorized })
  //                 const metaBatch1 = getNewMetaBatchEvent(receipt1)

  //                 await progressToNextBatch()

  //                 const amount2 = randomSmallAmount()
  //                 const receipt2 = await openBuyOrder(authorized, collaterals[index], amount2, { from: authorized })

  //                 assertEvent(receipt2, 'NewMetaBatch')
  //                 const metaBatch2 = getNewMetaBatchEvent(receipt2)

  //                 assert.isAbove(metaBatch2.id.toNumber(), metaBatch1.id.toNumber())
  //                 assert.equal(metaBatch2.supply.toNumber(), supply.toNumber())
  //               })

  //               it('it should initialize new batch [when there is no previous batch]', async () => {
  //                 const amount = randomSmallAmount()
  //                 const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })

  //                 assertEvent(receipt, 'NewBatch')
  //                 const batch = getNewBatchEvent(receipt)

  //                 assert.isAbove(batch.id.toNumber(), 0)
  //                 assert.equal(batch.collateral, collaterals[index])
  //                 assert.equal(batch.supply.toNumber(), VIRTUAL_SUPPLIES[index])
  //                 assert.equal(batch.balance.toNumber(), VIRTUAL_BALANCES[index])
  //                 assert.equal(batch.reserveRatio.toNumber(), RESERVE_RATIOS[index])
  //               })

  //               it('it should initialize new batch [when there are previous batches]', async () => {
  //                 const amount1 = randomSmallAmount()
  //                 const fee = computeBuyFee(amount1)
  //                 const receipt1 = await openBuyOrder(authorized, collaterals[index], amount1, { from: authorized })
  //                 const batch1 = getNewBatchEvent(receipt1)

  //                 const supply = await formula.calculatePurchaseReturn(
  //                   VIRTUAL_SUPPLIES[index],
  //                   VIRTUAL_BALANCES[index],
  //                   RESERVE_RATIOS[index],
  //                   amount1.minus(fee)
  //                 )

  //                 await progressToNextBatch()

  //                 const amount2 = randomSmallAmount()
  //                 const receipt2 = await openBuyOrder(authorized, collaterals[index], amount2, { from: authorized })

  //                 assertEvent(receipt2, 'NewBatch')
  //                 const batch2 = getNewBatchEvent(receipt2)

  //                 assert.isAbove(batch2.id.toNumber(), batch1.id.toNumber())
  //                 assert.equal(batch2.collateral, collaterals[index])
  //                 assert.equal(batch2.supply.toNumber(), VIRTUAL_SUPPLIES[index] + supply.toNumber())
  //                 assert.equal(batch2.balance.toNumber(), VIRTUAL_BALANCES[index] + amount1.minus(fee).toNumber())
  //                 assert.equal(batch2.reserveRatio.toNumber(), RESERVE_RATIOS[index])
  //               })

  //               it('it should register buy order', async () => {
  //                 const amount = randomSmallAmount()
  //                 const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })

  //                 // const fee = computeBuyFee(amount)
  //                 // const amountAfterFee = amount.minus(fee)

  //                 assertEvent(receipt, 'NewBuyOrder')

  //                 // const batchId = getBuyOrderBatchId(receipt)
  //                 // const batch = await getBatch(batchId, ETH)

  //                 // assert.equal(batch.initialized, true)
  //                 // assert.equal(batch.supply.toNumber(), VIRTUAL_SUPPLIES[0])
  //                 // assert.equal(batch.balance.toNumber(), VIRTUAL_BALANCES[0])
  //                 // assert.equal(batch.reserveRatio.toNumber(), RESERVE_RATIOS[0])

  //                 // // check total buy spend
  //                 // // check total buy return
  //                 // // check tokensto be claimed

  //                 // console.log(batch.totalBuyReturn.toNumber())
  //                 // const vSupply = 10000000000
  //                 // const ret1 = await formula.calculatePurchaseReturn(10, 1, RESERVE_RATIOS[0], 100000000000000000)
  //                 // console.log('AMOUNT BOUGHT FOR:' + ret1.toNumber())
  //                 // const ret = await formula.calculateSaleReturn(2000, 101, 100000, 1000)
  //                 // console.log('COLLATERAL FOR LIQUIDATION: ' + ret.toNumber())
  //               })

  //               it('it should deduct fee', async () => {
  //                 const oldBalance = await balance(collaterals[index], beneficiary)
  //                 const amount = randomSmallAmount()
  //                 const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })

  //                 const batchId = getBuyOrderBatchId(receipt)
  //                 const batch = await getBatch(batchId, collaterals[index])

  //                 const buyFee = computeBuyFee(amount)
  //                 const newBalance = await balance(collaterals[index], beneficiary)

  //                 assert.equal(newBalance.minus(oldBalance).toNumber(), buyFee.toNumber())
  //                 assert.equal(batch.totalBuySpend.toNumber(), amount.minus(buyFee).toNumber())
  //               })

  //               it('it should collect collateral', async () => {
  //                 const oldBalance = await balance(collaterals[index], pool.address)
  //                 const amount = randomSmallAmount()
  //                 const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })

  //                 const batchId = getBuyOrderBatchId(receipt)
  //                 const batch = await getBatch(batchId, collaterals[index])

  //                 const buyFee = computeBuyFee(amount)
  //                 const newBalance = await balance(collaterals[index], pool.address)

  //                 assert.equal(newBalance.minus(oldBalance).toNumber(), amount.minus(buyFee).toNumber())
  //               })

  //               it('it should update batch', async () => {
  //                 const amount = randomSmallAmount()
  //                 const fee = computeBuyFee(amount)

  //                 const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
  //                 const batchId = getBuyOrderBatchId(receipt)
  //                 const batch = await getBatch(batchId, collaterals[index])

  //                 const buyReturn = await formula.calculatePurchaseReturn(
  //                   VIRTUAL_SUPPLIES[index],
  //                   VIRTUAL_BALANCES[index],
  //                   RESERVE_RATIOS[index],
  //                   amount.minus(fee)
  //                 )

  //                 assert.equal(batch.totalBuySpend.toNumber(), amount.minus(fee).toNumber())
  //                 assert.equal(batch.totalBuyReturn.toNumber(), buyReturn.toNumber())
  //                 assert.equal(batch.totalSellSpend.toNumber(), 0)
  //                 assert.equal(batch.totalSellReturn.toNumber(), 0)
  //               })

  //               it('it should update the amount of token to be minted', async () => {
  //                 const amount = randomSmallAmount()
  //                 const fee = computeBuyFee(amount)
  //                 const buyReturn = await formula.calculatePurchaseReturn(
  //                   VIRTUAL_SUPPLIES[index],
  //                   VIRTUAL_BALANCES[index],
  //                   RESERVE_RATIOS[index],
  //                   amount.minus(fee)
  //                 )

  //                 await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
  //                 const tokensToBeMinted = await curve.tokensToBeMinted()

  //                 assert.equal(tokensToBeMinted.toNumber(), buyReturn.toNumber())
  //               })
  //             })

  //             context('> but order breaks maximum batch slippage', () => {
  //               it('it should revert', async () => {
  //                 // let's open a small order first
  //                 await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //                 // then let's open a big order and assert it reverts
  //                 await assertRevert(() => openBuyOrder(authorized, collaterals[index], randomBigAmount(), { from: authorized }))
  //               })
  //             })
  //           })

  //           context('> but sender does not have sufficient funds', () => {
  //             it('it should revert', async () => {
  //               const amount = randomSmallAmount()
  //               // let's burn the the extra tokens to end up with a small balance
  //               await token1.transfer(unauthorized, INITIAL_TOKEN_BALANCE - amount, { from: authorized })

  //               await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount.add(1), { from: authorized, value: amount.minus(1) })) // should revert both for ETH and ERC20
  //             })
  //           })
  //         })

  //         context('> but value is zero', () => {
  //           it('it should revert [ETH]', async () => {
  //             await assertRevert(() => openBuyOrder(authorized, collaterals[index], 0, { from: authorized }))
  //           })
  //         })
  //       })

  //       context('> but collateral is not whitelisted', () => {
  //         it('it should revert', async () => {
  //           // we can't test un-whitelisted ETH unless we re-deploy a DAO without ETH as a whitelisted
  //           // collateral just for that use case it's not worth it because the logic is the same than ERC20 anyhow
  //           const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
  //           await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
  //           await assertRevert(() => openBuyOrder(authorized, unlisted.address, randomSmallAmount(), { from: authorized }))
  //         })
  //       })
  //     })

  //     context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
  //       it('it should revert', async () => {
  //         await assertRevert(() => openBuyOrder(unauthorized, collaterals[index], randomSmallAmount(), { from: unauthorized }))
  //       })
  //     })
  //   })
  // })
  // #endregion

  // #region createSellOrder
  // context('> #createSellOrder', () => {
  //   context('> sender has OPEN_SELL_ORDER_ROLE', () => {
  //     context('> and collateral is whitelisted', () => {
  //       context('> and amount is not zero', () => {
  //         context('> and sender has sufficient funds', () => {
  //           context('> ETH', () => {
  //             it('it should initialize and update token batch', async () => {
  //               const amount = randomAmount()
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: amount })
  //               const receipt = await curve.createSellOrder(authorized, ETH, balance, { from: authorized })

  //               const batchId = getSellOrderBatchId(receipt)
  //               const batch = await getBatch(ETH, batchId)
  //               const buyFee = computeBuyFee(amount)

  //               assert.equal(batch.initialized, true)
  //               assert.equal(batch.cleared, false)
  //               assert.equal(batch.poolBalance.toNumber(), amount.minus(buyFee).toNumber())
  //               assert.equal(batch.totalSupply.toNumber(), balance.toNumber())
  //               assert.equal(batch.totalBuySpend.toNumber(), 0)
  //               assert.equal(batch.totalBuyReturn.toNumber(), 0)
  //               assert.equal(batch.totalSellSpend.toNumber(), balance.toNumber())
  //               assert.equal(batch.totalSellReturn.toNumber(), 0)
  //             })

  //             it('it should create sell order', async () => {
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
  //               const receipt = await curve.createSellOrder(authorized, ETH, balance, { from: authorized })
  //               const batchId = getSellOrderBatchId(receipt)

  //               await progressToNextBatch()
  //               await curve.clearBatches()
  //               await curve.claimSell(authorized, ETH, batchId)

  //               assertEvent(receipt, 'NewSellOrder')
  //               assert.equal((await token.totalSupply()).toNumber(), 0)
  //             })

  //             it('it should deduct fee', async () => {
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })

  //               const virtualSupply = new Decimal(VIRTUAL_SUPPLIES[0])
  //               const actualTotalSupply = await token.totalSupply()
  //               const totalSupply = virtualSupply.plus(actualTotalSupply.toString(10))

  //               const virtualBalance = new Decimal(VIRTUAL_BALANCES[0])
  //               const actualBalance = await controller.balanceOf(pool.address, ETH)
  //               const poolBalance = virtualBalance.plus(actualBalance.toString(10))

  //               const reserveRatio = new Decimal(RESERVE_RATIOS[0]).div(PPM)

  //               const expectedReturn = getSell({ amount: balance, totalSupply, balance: poolBalance, reserveRatio })
  //               const sellFee = computeSellFee(expectedReturn.bancor)
  //               const expectedReturnAfterFee = expectedReturn.bancor.sub(sellFee.toString(10))

  //               const ETHBalanceBefore = await getBalance(authorized)

  //               const createSellOrderTx = await curve.createSellOrder(authorized, ETH, balance, { from: authorized, gasCost })
  //               const createSellOrderTxGas = gasCost.mul(createSellOrderTx.receipt.gasUsed)

  //               const batchId = getSellOrderBatchId(createSellOrderTx)
  //               const batch = await getBatch(ETH, batchId)
  //               assert.equal(batch.totalSellSpend.toNumber(), balance.toNumber())

  //               await progressToNextBatch()
  //               const clearBatchesTx = await curve.clearBatches({ from: authorized })
  //               const clearBatchesTxGas = gasCost.mul(clearBatchesTx.receipt.gasUsed)

  //               const claimTx = await curve.claimSell(authorized, ETH, batchId, { from: authorized })
  //               const claimTxGas = gasCost.mul(claimTx.receipt.gasUsed)
  //               const totalGasCosts = claimTxGas.plus(createSellOrderTxGas).plus(clearBatchesTxGas)

  //               const ETHBalanceAfter = await getBalance(authorized)
  //               const resultOfSell = ETHBalanceAfter.sub(ETHBalanceBefore).plus(totalGasCosts)

  //               const marginOfError = 10

  //               assert(
  //                 resultOfSell
  //                   .sub(expectedReturnAfterFee)
  //                   .abs()
  //                   .lt(marginOfError),
  //                 `Result of sell (${resultOfSell.toString(10)}) did not equal expectedReturnAfterFee ${expectedReturnAfterFee.toString(
  //                   10
  //                 )} within a margin of error of ${marginOfError}`
  //               )
  //             })

  //             it('it should clear previous batch', async () => {
  //               // buy bonded tokens to sell them afterwards
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
  //               // initialize two different collaterals in the same batch [no need to test with sell orders because buy and sell orders are registered in the same batch]
  //               const amount1 = randomAmount()
  //               const receipt1 = await curve.createBuyOrder(authorized, ETH, amount1, { from: authorized, value: amount1 })
  //               const receipt2 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
  //               // assert that these two orders have the same batchId
  //               const batchId1 = getBuyOrderBatchId(receipt1)
  //               const batchId2 = getBuyOrderBatchId(receipt2)
  //               assert.equal(batchId1.toNumber(), batchId2.toNumber())
  //               // move to next batch
  //               await progressToNextBatch()
  //               // create a sell order in this next batch
  //               const receipt3 = await curve.createSellOrder(authorized, ETH, balance, { from: authorized })
  //               // get previous collateral batches
  //               const batchETH = await getBatch(ETH, batchId1)
  //               const batchToken1 = await getBatch(token1.address, batchId2)
  //               // assert that these previous collateral batches are cleared
  //               assertEvent(receipt3, 'ClearBatch', 3) // batch is cleared for token2 even though there was no order
  //               assert.equal(batchETH.cleared, true)
  //               assert.equal(batchToken1.cleared, true)
  //             })
  //           })

  //           context('> and there are multiple orders', () => {
  //             it('it should batch orders', async () => {
  //               // already tested in the ERC20 version of the test below
  //             })
  //           })

  //           context('> ERC20', () => {
  //             it('it should initialize and update token batch', async () => {
  //               const amount = randomAmount()
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount })
  //               const receipt = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })

  //               const batchId = getSellOrderBatchId(receipt)
  //               const batch = await getBatch(token1.address, batchId)
  //               const buyFee = computeBuyFee(amount)

  //               assert.equal(batch.initialized, true)
  //               assert.equal(batch.cleared, false)
  //               assert.equal(batch.poolBalance.toNumber(), amount.minus(buyFee).toNumber())
  //               assert.equal(batch.totalSupply.toNumber(), balance.toNumber())
  //               assert.equal(batch.totalBuySpend.toNumber(), 0)
  //               assert.equal(batch.totalBuyReturn.toNumber(), 0)
  //               assert.equal(batch.totalSellSpend.toNumber(), balance.toNumber())
  //               assert.equal(batch.totalSellReturn.toNumber(), 0)
  //             })

  //             it('it should create sell order', async () => {
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //               const receipt = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })

  //               assertEvent(receipt, 'NewSellOrder')
  //               assert.equal((await token.totalSupply()).toNumber(), 0)
  //             })

  //             it('it should deduct fee', async () => {
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

  //               const virtualSupply = new Decimal(VIRTUAL_SUPPLIES[1])
  //               const actualTotalSupply = await token.totalSupply()
  //               const totalSupply = virtualSupply.plus(actualTotalSupply.toString(10))

  //               const virtualBalance = new Decimal(VIRTUAL_BALANCES[1])
  //               const actualBalance = await controller.balanceOf(pool.address, token1.address)
  //               const poolBalance = virtualBalance.plus(actualBalance.toString(10))

  //               const reserveRatio = new Decimal(RESERVE_RATIOS[1]).div(PPM)

  //               const expectedReturn = getSell({
  //                 amount: balance,
  //                 totalSupply,
  //                 balance: poolBalance,
  //                 reserveRatio,
  //               })

  //               const sellFee = computeSellFee(expectedReturn.bancor)
  //               const expectedReturnAfterFee = expectedReturn.bancor.sub(sellFee)

  //               const ERC20BalanceBefore = await token1.balanceOf(authorized)

  //               const receipt = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })
  //               const batchId = getSellOrderBatchId(receipt)
  //               const batch = await getBatch(token1.address, batchId)

  //               assert.equal(batch.totalSellSpend.toNumber(), balance.toNumber())

  //               await progressToNextBatch()
  //               await curve.clearBatches()

  //               await curve.claimSell(authorized, token1.address, batchId)

  //               const ERC20balanceAfter = await token1.balanceOf(authorized)
  //               const resultOfSell = ERC20balanceAfter.sub(ERC20BalanceBefore)
  //               const marginOfError = 10
  //               const difference = resultOfSell.sub(expectedReturnAfterFee).abs()

  //               assert(
  //                 difference.lt(marginOfError),
  //                 `Result of sell (${resultOfSell.toString(10)}) did not equal expectedReturnAfterFee ${expectedReturnAfterFee.toString(
  //                   10
  //                 )} with difference of ${difference.toString(10)}`
  //               )
  //             })

  //             it('it should clear previous batch', async () => {
  //               // buy bonded tokens to sell them afterwards
  //               const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //               // initialize two different collaterals in the same batch [no need to test with sell orders because buy and sell orders are registered in the same batch]
  //               const amount1 = randomAmount()
  //               const receipt1 = await curve.createBuyOrder(authorized, ETH, amount1, { from: authorized, value: amount1 })
  //               const receipt2 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
  //               // assert that these two orders have the same batchId
  //               const batchId1 = getBuyOrderBatchId(receipt1)
  //               const batchId2 = getBuyOrderBatchId(receipt2)
  //               assert.equal(batchId1.toNumber(), batchId2.toNumber())
  //               // move to next batch
  //               await progressToNextBatch()
  //               // create a sell order in this next batch
  //               const receipt3 = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })
  //               // get previous collateral batches
  //               const batchETH = await getBatch(ETH, batchId1)
  //               const batchToken1 = await getBatch(token1.address, batchId2)
  //               // assert that these previous collateral batches are cleared
  //               assertEvent(receipt3, 'ClearBatch', 3) // batch is cleared for token2 even though there was no order
  //               assert.equal(batchETH.cleared, true)
  //               assert.equal(batchToken1.cleared, true)
  //             })
  //           })

  //           context('> and there are multiple orders', () => {
  //             it('it should batch orders', async () => {
  //               // compute random amounts
  //               const amountETH1 = randomAmount()
  //               const amountETH2 = randomAmount()
  //               const amountToken11 = randomAmount()
  //               const amountToken12 = randomAmount()
  //               const amountToken21 = randomAmount()
  //               const amountToken22 = randomAmount()
  //               // create and claim some buy orders
  //               await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: amountETH1 })
  //               const balance1 = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: amountToken11 })
  //               const balance2 = await createAndClaimBuyOrder({ address: authorized2, collateralToken: token2.address, amount: amountToken22 })
  //               // move to next batch
  //               await progressToNextBatch()
  //               // create some buy and sell orders
  //               const third = balance1.div(3).round(0)
  //               const receipt1 = await curve.createSellOrder(authorized, token1.address, third, { from: authorized })
  //               const receipt2 = await curve.createSellOrder(authorized, ETH, third, { from: authorized })
  //               const receipt3 = await curve.createBuyOrder(authorized, token2.address, amountToken21, { from: authorized })
  //               const receipt4 = await curve.createSellOrder(authorized2, token2.address, balance2, { from: authorized2 })
  //               const receipt5 = await curve.createBuyOrder(authorized2, token1.address, amountToken12, { from: authorized2 })
  //               const receipt6 = await curve.createBuyOrder(authorized2, ETH, amountETH2, { from: authorized2, value: amountETH2 })
  //               // assert that the orders have all been registered
  //               assertEvent(receipt1, 'NewSellOrder')
  //               assertEvent(receipt2, 'NewSellOrder')
  //               assertEvent(receipt3, 'NewBuyOrder')
  //               assertEvent(receipt4, 'NewSellOrder')
  //               assertEvent(receipt5, 'NewBuyOrder')
  //               assertEvent(receipt6, 'NewBuyOrder')
  //               // assert that the orders are all in the same batch
  //               const batchId1 = getSellOrderBatchId(receipt1)
  //               const batchId2 = getSellOrderBatchId(receipt2)
  //               const batchId3 = getBuyOrderBatchId(receipt3)
  //               const batchId4 = getSellOrderBatchId(receipt4)
  //               const batchId5 = getBuyOrderBatchId(receipt5)
  //               const batchId6 = getBuyOrderBatchId(receipt6)
  //               assert.equal(batchId1, batchId2)
  //               assert.equal(batchId1, batchId3)
  //               assert.equal(batchId1, batchId4)
  //               assert.equal(batchId1, batchId5)
  //               assert.equal(batchId1, batchId6)
  //               // assert that ETH batch is correct
  //               const batchETH = await getBatch(ETH, batchId1)
  //               const buyFeeETH1 = computeBuyFee(amountETH1)
  //               const buyFeeETH2 = computeBuyFee(amountETH2)
  //               assert.equal(batchETH.initialized, true)
  //               assert.equal(batchETH.cleared, false)
  //               assert.equal(batchETH.poolBalance.toNumber(), amountETH1.minus(buyFeeETH1).toNumber())
  //               assert.equal(batchETH.totalSupply.toNumber(), balance1.plus(balance2).toNumber())
  //               assert.equal(batchETH.totalBuySpend.toNumber(), amountETH2.minus(buyFeeETH2).toNumber())
  //               assert.equal(batchETH.totalBuyReturn.toNumber(), 0)
  //               assert.equal(batchETH.totalSellSpend.toNumber(), third.toNumber())
  //               assert.equal(batchETH.totalSellReturn.toNumber(), 0)
  //               // assert that token1 batch is correct
  //               const batch1 = await getBatch(token1.address, batchId1)
  //               const buyFeeToken11 = computeBuyFee(amountToken11)
  //               const buyFeeToken12 = computeBuyFee(amountToken12)
  //               assert.equal(batch1.initialized, true)
  //               assert.equal(batch1.cleared, false)
  //               assert.equal(batch1.poolBalance.toNumber(), amountToken11.minus(buyFeeToken11).toNumber())
  //               assert.equal(batch1.totalSupply.toNumber(), balance1.plus(balance2).toNumber())
  //               assert.equal(batch1.totalBuySpend.toNumber(), amountToken12.minus(buyFeeToken12).toNumber())
  //               assert.equal(batch1.totalBuyReturn.toNumber(), 0)
  //               assert.equal(batch1.totalSellSpend.toNumber(), third.toNumber())
  //               assert.equal(batch1.totalSellReturn.toNumber(), 0)
  //               // assert that token2 batch is correct
  //               const batch2 = await getBatch(token2.address, batchId1)
  //               const buyFeeToken21 = computeBuyFee(amountToken21)
  //               const buyFeeToken22 = computeBuyFee(amountToken22)
  //               assert.equal(batch2.initialized, true)
  //               assert.equal(batch2.cleared, false)
  //               assert.equal(batch2.poolBalance.toNumber(), amountToken22.minus(buyFeeToken22).toNumber())
  //               assert.equal(batch2.totalSupply.toNumber(), balance1.plus(balance2).toNumber())
  //               assert.equal(batch2.totalBuySpend.toNumber(), amountToken21.minus(buyFeeToken21).toNumber())
  //               assert.equal(batch2.totalBuyReturn.toNumber(), 0)
  //               assert.equal(batch2.totalSellSpend.toNumber(), balance2.toNumber())
  //               assert.equal(batch2.totalSellReturn.toNumber(), 0)
  //             })
  //           })
  //         })

  //         context('> but sender does not have sufficient funds', () => {
  //           it('it should revert [ETH]', async () => {
  //             const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //             await assertRevert(() => curve.createSellOrder(authorized, ETH, balance.plus(10), { from: authorized }))
  //           })

  //           it('it should revert [ERC20]', async () => {
  //             const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //             await assertRevert(() => curve.createSellOrder(authorized, token1.address, balance.plus(10), { from: authorized }))
  //           })
  //         })
  //       })

  //       context('> but amount is zero', () => {
  //         it('it should revert [ETH]', async () => {
  //           await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //           await assertRevert(() => curve.createSellOrder(authorized, ETH, 0, { from: authorized }))
  //         })

  //         it('it should revert [ERC20]', async () => {
  //           await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //           await assertRevert(() => curve.createSellOrder(authorized, token1.address, 0, { from: authorized }))
  //         })
  //       })
  //     })

  //     context('> but collateral is not whitelisted', () => {
  //       it('it should revert [ETH]', async () => {
  //         // we can't test unless we re-deploy a DAO without ETH as a whitelisted collateral just for that use case
  //         // it's not worth it because the logic is the same than ERC20 anyhow
  //       })

  //       it('it should revert [ERC20]', async () => {
  //         const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
  //         await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
  //         const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //         await assertRevert(() => curve.createSellOrder(authorized, unlisted.address, balance, { from: authorized }))
  //       })
  //     })
  //   })

  //   context('> sender does not have OPEN_SELL_ORDER_ROLE', () => {
  //     it('it should revert [ETH]', async () => {
  //       const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
  //       // test both ETH and ERC20
  //       await assertRevert(() => curve.createSellOrder(unauthorized, ETH, balance, { from: unauthorized }))
  //     })

  //     it('it should revert [ERC20]', async () => {
  //       const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
  //       await token.transfer(unauthorized, balance, { from: authorized })
  //       // test both ETH and ERC20
  //       await assertRevert(() => curve.createSellOrder(unauthorized, token1.address, balance, { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region openSellOrder
  context('> #openSellOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> sender has OPEN_SELL_ORDER_ROLE', () => {
        context('> and collateral is whitelisted', () => {
          context('> and value is not zero', () => {
            context('> and sender has sufficient funds', () => {
              // and there is enough collateral in pool
              context('> and order does not break maximum batch slippage', () => {
                // it('it should initialize new meta-batch [if needed]', async () => {
                //   const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
                //   const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                //   assertEvent(receipt, 'NewMetaBatch')
                //   const metaBatch = getNewMetaBatchEvent(receipt)

                //   assert.isAbove(metaBatch.id.toNumber(), 0)
                //   assert.equal(metaBatch.supply.toNumber(), _balance.toNumber())
                // })

                // it('it should initialize new batch [if needed]', async () => {
                //   const amount = randomSmallAmount()
                //   const fee = computeBuyFee(amount)

                //   const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                //   const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                //   assertEvent(receipt, 'NewBatch')
                //   const batch = getNewBatchEvent(receipt)

                //   assert.isAbove(batch.id.toNumber(), 0)
                //   assert.equal(batch.collateral, collaterals[index])
                //   assert.equal(batch.supply.toNumber(), VIRTUAL_SUPPLIES[index] + _balance.toNumber())
                //   assert.equal(batch.balance.toNumber(), VIRTUAL_BALANCES[index] + amount.minus(fee).toNumber())
                //   assert.equal(batch.reserveRatio.toNumber(), RESERVE_RATIOS[index])
                // })

                // it('it should register sell order', async () => {
                //   const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
                //   const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                //   assertEvent(receipt, 'NewSellOrder')
                // })

                // it('it should collect bonds', async () => {
                //   const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
                //   await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
                //   const newBalance = await balance(token.address, authorized)

                //   assert.equal(newBalance.toNumber(), 0)
                // })

                // it('it should update batch', async () => {
                //   const amount = randomSmallAmount()
                //   const fee = computeBuyFee(amount)

                //   const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                //   const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                //   const batchId = getSellOrderBatchId(receipt)
                //   const batch = await getBatch(batchId, collaterals[index])

                //   const sellReturn = await formula.calculateSaleReturn(
                //     VIRTUAL_SUPPLIES[index] + _balance.toNumber(),
                //     VIRTUAL_BALANCES[index] + amount.minus(fee).toNumber(),
                //     RESERVE_RATIOS[index],
                //     _balance
                //   )

                //   assert.equal(batch.totalBuySpend.toNumber(), 0)
                //   assert.equal(batch.totalBuyReturn.toNumber(), 0)
                //   assert.equal(batch.totalSellSpend.toNumber(), _balance.toNumber())
                //   assert.equal(batch.totalSellReturn.toNumber(), sellReturn.toNumber())
                // })

                it('it should update the amount of collateral to be claimed', async () => {
                  const amount = randomSmallAmount()
                  const fee = computeBuyFee(amount)

                  const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                  await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                  const sellReturn = await formula.calculateSaleReturn(
                    VIRTUAL_SUPPLIES[index] + _balance.toNumber(),
                    VIRTUAL_BALANCES[index] + amount.minus(fee).toNumber(),
                    RESERVE_RATIOS[index],
                    _balance
                  )
                  const collateralToBeClaimed = await curve.collateralsToBeClaimed(collaterals[index])

                  assert.equal(collateralToBeClaimed.toNumber(), sellReturn.toNumber())
                })
              })

              // context('> but order breaks maximum batch slippage', () => {
              //   it('it should revert', async () => {
              //     // let's open a small order first
              //     await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
              //     // then let's open a big order and assert it reverts
              //     await assertRevert(() => openBuyOrder(authorized, collaterals[index], randomBigAmount(), { from: authorized }))
              //   })
              // })
            })

            // context('> but sender does not have sufficient funds', () => {
            //   it('it should revert', async () => {
            //     const amount = randomSmallAmount()
            //     // let's burn the the extra tokens to end up with a small balance
            //     await token1.transfer(unauthorized, INITIAL_TOKEN_BALANCE - amount, { from: authorized })

            //     await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount.add(1), { from: authorized, value: amount.minus(1) })) // should revert both for ETH and ERC20
            //   })
            // })
          })

          // context('> but value is zero', () => {
          //   it('it should revert [ETH]', async () => {
          //     await assertRevert(() => openBuyOrder(authorized, collaterals[index], 0, { from: authorized }))
          //   })
          // })
        })

        // context('> but collateral is not whitelisted', () => {
        //   it('it should revert', async () => {
        //     // we can't test un-whitelisted ETH unless we re-deploy a DAO without ETH as a whitelisted
        //     // collateral just for that use case it's not worth it because the logic is the same than ERC20 anyhow
        //     const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
        //     await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
        //     await assertRevert(() => openBuyOrder(authorized, unlisted.address, randomSmallAmount(), { from: authorized }))
        //   })
        // })
      })

      // context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
      //   it('it should revert', async () => {
      //     await assertRevert(() => openBuyOrder(unauthorized, collaterals[index], randomSmallAmount(), { from: unauthorized }))
      //   })
      // })
    })
  })
  // #endregion

  // #region claimBuyOrder
  // context('> #claimBuyOrder', () => {
  //   forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
  //     const index = round === 'ETH' ? 0 : 1

  //     context('> collateral is whitelisted', () => {
  //       context('> and batch is over', () => {
  //         context('> and there are bonds to claim', () => {
  //           it('it should register claim', async () => {
  //             const receipt1 = await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //             const batchId = getBuyOrderBatchId(receipt1)

  //             await progressToNextBatch()
  //             const receipt2 = await curve.claimBuyOrder(authorized, batchId, collaterals[index])

  //             assertEvent(receipt2, 'ReturnBuyOrder')
  //           })

  //           it('it should return bonds', async () => {
  //             const amount = randomSmallAmount()
  //             const fee = computeBuyFee(amount)

  //             const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
  //             const batchId = getBuyOrderBatchId(receipt)
  //             const purchase = await formula.calculatePurchaseReturn(VIRTUAL_SUPPLIES[index], VIRTUAL_BALANCES[index], RESERVE_RATIOS[index], amount.minus(fee))

  //             await progressToNextBatch()

  //             await curve.claimBuyOrder(authorized, batchId, collaterals[index])
  //             const _balance = await balance(token.address, authorized)

  //             assert.equal(_balance.toNumber(), purchase.toNumber())
  //           })

  //           it('it should update the amount of token to be minted', async () => {
  //             const amount = randomSmallAmount()
  //             const fee = computeBuyFee(amount)

  //             const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
  //             const batchId = getBuyOrderBatchId(receipt)
  //             const purchase = await formula.calculatePurchaseReturn(VIRTUAL_SUPPLIES[index], VIRTUAL_BALANCES[index], RESERVE_RATIOS[index], amount.minus(fee))
  //             const tokensToBeMinted1 = await curve.tokensToBeMinted()

  //             assert.equal(tokensToBeMinted1.toNumber(), purchase.toNumber())

  //             await progressToNextBatch()

  //             await curve.claimBuyOrder(authorized, batchId, collaterals[index])
  //             const tokensToBeMinted2 = await curve.tokensToBeMinted()

  //             assert.equal(tokensToBeMinted2.toNumber(), 0)
  //           })
  //         })

  //         context('> but there are no bonds to claim', () => {
  //           context('> because address has no pending buy order at all', () => {
  //             it('it should revert', async () => {
  //               const receipt = await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //               const batchId = getBuyOrderBatchId(receipt)

  //               await progressToNextBatch()

  //               await assertRevert(() => curve.claimBuyOrder(authorized2, batchId, collaterals[index]))
  //             })
  //           })

  //           context('> because address has a pending buy order but created through another collateral', () => {
  //             it('it should revert', async () => {
  //               const receipt = await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //               const batchId = getBuyOrderBatchId(receipt)
  //               const _index = index === 1 ? 0 : 1

  //               await progressToNextBatch()

  //               await assertRevert(() => curve.claimBuyOrder(authorized, batchId, collaterals[_index]))
  //             })
  //           })

  //           context('> because buy order has already been claimed', () => {
  //             it('it should revert', async () => {
  //               const receipt = await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //               const batchId = getBuyOrderBatchId(receipt)

  //               await progressToNextBatch()
  //               await curve.claimBuyOrder(authorized, batchId, collaterals[index])

  //               await assertRevert(() => curve.claimBuyOrder(authorized, batchId, collaterals[index]))
  //             })
  //           })
  //         })
  //       })

  //       context('> but batch is not yet over', () => {
  //         it('it should revert', async () => {
  //           const receipt = await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //           const batchId = getBuyOrderBatchId(receipt)

  //           await assertRevert(() => curve.claimBuyOrder(authorized, batchId, collaterals[index]))
  //         })
  //       })
  //     })

  //     context('> but collateral is not whitelisted', () => {
  //       it('it should revert', async () => {
  //         const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
  //         await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })

  //         const receipt = await openBuyOrder(authorized, collaterals[index], randomSmallAmount(), { from: authorized })
  //         const batchId = getBuyOrderBatchId(receipt)

  //         await progressToNextBatch()

  //         await assertRevert(() => curve.claimBuyOrder(authorized, batchId, unlisted.address))
  //       })
  //     })
  //   })
  // })
  // #endregion

  // #region maths
  // context('#maths', () => {
  //   forEach(['ETH', 'ERC20']).describe(`> %s`, collateralTokenIndex => {
  //     // forEach(['ETH', 'ERC20', 'ETH', 'ERC20', 'ETH', 'ERC20']).describe(`> %s`, collateralTokenIndex => {
  //     let totalSupply, balance, reserveRatio, _token, collateralToken, tokens
  //     collateralTokenIndex = collateralTokenIndex === 'ETH' ? 0 : 1
  //     const percentageOffsetErrorMargin = 0.999
  //     beforeEach(() => {
  //       totalSupply = new web3.BigNumber(VIRTUAL_SUPPLIES[collateralTokenIndex])
  //       balance = new web3.BigNumber(VIRTUAL_BALANCES[collateralTokenIndex])
  //       reserveRatio = new web3.BigNumber(RESERVE_RATIOS[collateralTokenIndex]).div(PPM)
  //       tokens = [ETH, token1, token2]
  //       _token = tokens[collateralTokenIndex]
  //       collateralToken = typeof _token.address === 'undefined' ? ETH : _token.address
  //     })

  //     // #region buyOrders
  //     context('> there are just buy orders', () => {
  //       it('it should return the correct estimate', async () => {
  //         let amount = randomAmount()
  //         const fee = computeBuyFee(amount)
  //         const amountAfterFee = amount.minus(fee)
  //         let expectedReturn = getBuy({
  //           amount: amountAfterFee,
  //           totalSupply,
  //           balance,
  //           reserveRatio,
  //         })
  //         expectedReturn = new web3.BigNumber(expectedReturn.slope.toFixed(0))
  //         let estimatedReturn = await curve.getBuy(collateralToken, '0', '0', amountAfterFee.toString(10))

  //         let numerator = estimatedReturn.gt(expectedReturn) ? expectedReturn : estimatedReturn
  //         let denominator = estimatedReturn.gt(expectedReturn) ? estimatedReturn : expectedReturn
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `getBuy estimate was wrong expectedReturn: ${expectedReturn.toString(10)} estimatedReturn: ${estimatedReturn.toString(
  //             10
  //           )} percentageOffset: ${percentageOffset.toString(10)}`
  //         )
  //       })

  //       it('it should match the estimate to the result for one order', async () => {
  //         const amount = randomAmount()
  //         const fee = computeBuyFee(amount)

  //         const estimatedReturn = await curve.getBuy(collateralToken, 0, 0, amount.minus(fee))
  //         const result = await createAndClaimBuyOrder({ address: authorized, collateralToken, amount, from: authorized })
  //         assert.equal(estimatedReturn.toNumber(), result.toNumber())
  //       })

  //       it('it should match the estimate to the result for two orders', async () => {
  //         const amount1 = randomAmount()
  //         const amount2 = randomAmount()
  //         const fee1 = computeBuyFee(amount1)
  //         const fee2 = computeBuyFee(amount2)
  //         const amount = amount1.plus(amount2)

  //         const estimatedTotalReturn = await curve.getBuy(collateralToken, 0, 0, amount.minus(fee1).minus(fee2))
  //         const percentage1 = amount1.div(amount)
  //         const estimatedReturn1 = estimatedTotalReturn.mul(percentage1).round(0)
  //         const estimatedReturn2 = estimatedTotalReturn.sub(estimatedReturn1).round(0)

  //         const batchId1 = await buyToken({ curve, address: authorized, collateralToken, amount: amount1, from: authorized })
  //         const batchId2 = await buyToken({ curve, address: authorized2, collateralToken, amount: amount2, from: authorized2 })

  //         assert.equal(batchId1, batchId2)

  //         await progressToNextBatch()
  //         await curve.clearBatches({ from: root })

  //         await curve.claimBuy(authorized, collateralToken, batchId1, { from: root })
  //         await curve.claimBuy(authorized2, collateralToken, batchId1, { from: root })

  //         const balance1 = await token.balanceOf(authorized)
  //         const balance2 = await token.balanceOf(authorized2)

  //         let numerator = balance1.gt(estimatedReturn1) ? estimatedReturn1 : balance1
  //         let denominator = balance1.gt(estimatedReturn1) ? balance1 : estimatedReturn1
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `estimatedReturn1: ${estimatedReturn1.toString()} balance1: ${balance1.toString(10)} percentageOffset: ${percentageOffset.toString(10)}`
  //         )

  //         numerator = balance2.gt(estimatedReturn2) ? estimatedReturn2 : balance2
  //         denominator = balance2.gt(estimatedReturn2) ? balance2 : estimatedReturn2
  //         percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `estimatedReturn2: ${estimatedReturn2.toString()} balance2: ${balance2.toString(10)} percentageOffset: ${percentageOffset.toString(10)}`
  //         )
  //       })
  //     })
  //     // #endregion

  //     context('> there are just sell orders', () => {
  //       it('it should return the correct estimate', async () => {
  //         const balanceOf = await createAndClaimBuyOrder({ address: authorized, collateralToken, amount: randomAmount(), from: authorized })

  //         // sell half
  //         const amount = balanceOf.div(2).floor(0)
  //         const actualTotalSupply = await token.totalSupply()
  //         const actualBalance = await controller.balanceOf(pool.address, collateralToken)

  //         const combinedTotalSupply = totalSupply.plus(actualTotalSupply.toString(10))
  //         const combinedBalance = balance.plus(actualBalance.toString(10))

  //         const _expectedReturn = getSell({ amount, totalSupply: combinedTotalSupply, balance: combinedBalance, reserveRatio })
  //         const expectedReturn = new web3.BigNumber(_expectedReturn.slope.toFixed(0))
  //         const expectedReturnAfterFee = expectedReturn.minus(computeSellFee(expectedReturn))
  //         // virtual supply and virtual balance included contract-side
  //         const estimatedReturn = await curve.getSell(collateralToken, actualTotalSupply, actualBalance, amount.toString(10))
  //         const estimatedReturnAfterFee = estimatedReturn.minus(computeSellFee(estimatedReturn))

  //         let numerator = expectedReturnAfterFee.gt(estimatedReturnAfterFee) ? estimatedReturnAfterFee : expectedReturnAfterFee
  //         let denominator = expectedReturnAfterFee.gt(estimatedReturnAfterFee) ? expectedReturnAfterFee : estimatedReturnAfterFee
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `expectedReturnAfterFee: ${expectedReturnAfterFee.toString()} estimatedReturnAfterFee: ${estimatedReturnAfterFee.toString(
  //             10
  //           )} percentageOffset: ${percentageOffset.toString(10)}`
  //         )
  //       })

  //       it('it should match the estimate to the result for one order', async () => {
  //         let balanceOf = await buyAndClaimTokens({
  //           token,
  //           curve,
  //           address: authorized,
  //           collateralToken,
  //           amount: randomAmount(),
  //           from: undefined,
  //         })
  //         // sell half
  //         let amount = balanceOf.div(2).floor(0)

  //         // fees
  //         let actualTotalSupply = await token.totalSupply()
  //         let actualBalance = await controller.balanceOf(pool.address, collateralToken)

  //         // virtualSupply and virtualBalance handled contract-side
  //         let estimatedReturn = await curve.getSell(collateralToken, actualTotalSupply, actualBalance, amount.toString(10))

  //         let estimatedReturnAfterFee = estimatedReturn.minus(computeSellFee(estimatedReturn))

  //         // BEGIN COUNTING GAS
  //         let collateralBalanceBefore
  //         if (collateralToken === ETH) {
  //           collateralBalanceBefore = await getBalance(authorized)
  //         } else {
  //           collateralBalanceBefore = await _token.balanceOf(authorized)
  //         }
  //         const { firstApprove, secondApprove, sellReceipt } = await sellHalfAsMuchAsPossible({
  //           curve,
  //           token,
  //           address: authorized,
  //           collateralToken,
  //         })
  //         const sellGas = new web3.BigNumber(sellReceipt.receipt.gasUsed)
  //         const firstApproveGas = new web3.BigNumber(firstApprove.receipt.gasUsed)
  //         const secondApproveGas = new web3.BigNumber(secondApprove.receipt.gasUsed)

  //         let NewSellOrder = sellReceipt.logs.find(l => l.event === 'NewSellOrder')
  //         let sellBatchNumber = NewSellOrder ? NewSellOrder.args.batchId.toNumber() : new Error('No Sell Order')

  //         await increaseBlocks(BLOCKS_IN_BATCH)

  //         await curve.clearBatches({ from: root })

  //         await curve.claimSell(authorized, collateralToken, sellBatchNumber, { from: root })

  //         let collateralBalanceAfter
  //         if (collateralToken === ETH) {
  //           let gasSpent = sellGas.plus(firstApproveGas).plus(secondApproveGas)
  //           collateralBalanceAfter = await getBalance(authorized)
  //           collateralBalanceAfter = collateralBalanceAfter.plus(gasSpent.mul(gasCost))
  //         } else {
  //           collateralBalanceAfter = await _token.balanceOf(authorized)
  //         }

  //         const netGain = collateralBalanceAfter.sub(collateralBalanceBefore)

  //         let numerator = netGain.gt(estimatedReturnAfterFee) ? estimatedReturnAfterFee : netGain
  //         let denominator = netGain.gt(estimatedReturnAfterFee) ? netGain : estimatedReturnAfterFee
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Didn't receive as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} netGain: ${netGain.toString(
  //             10
  //           )} estimatedReturnAfterFee: ${estimatedReturnAfterFee.toString(10)} percentageOffset: ${percentageOffset.toString(10)}`
  //         )
  //       })

  //       it('it should match the estimate to the result for two sells', async () => {
  //         let balanceOfOne = await buyAndClaimTokens({
  //           token,
  //           curve,
  //           address: authorized,
  //           collateralToken,
  //           amount: randomAmount(),
  //           from: authorized,
  //         })
  //         // sell half
  //         let firstAmount = balanceOfOne.div(2).floor(0)

  //         let balanceOfTwo = await buyAndClaimTokens({
  //           token,
  //           curve,
  //           address: authorized2,
  //           collateralToken,
  //           amount: randomAmount(),
  //           from: authorized2,
  //         })
  //         // sell half
  //         let secondAmount = balanceOfTwo.div(2).floor(0)

  //         let amount = firstAmount.plus(secondAmount)

  //         let actualTotalSupply = await token.totalSupply()
  //         let actualBalance = await controller.balanceOf(pool.address, collateralToken)

  //         // virtualSupply and virtualBalance handled contract-side
  //         let estimatedTotalReturn = await curve.getSell(collateralToken, actualTotalSupply, actualBalance, amount.toString(10))
  //         let estimatedTotalReturnAfterFee = estimatedTotalReturn.minus(computeSellFee(estimatedTotalReturn))

  //         let firstPercentage = firstAmount.div(amount)
  //         let secondPercentage = secondAmount.div(amount)

  //         let estimatedFirstReturn = estimatedTotalReturnAfterFee.mul(firstPercentage).floor(0)
  //         let estimatedSecondReturn = estimatedTotalReturnAfterFee.mul(secondPercentage).floor(0)

  //         await progressToNextBatch()

  //         // BEGIN COUNTING GAS

  //         // Seller 1
  //         let collateralBalanceBefore1
  //         if (collateralToken === ETH) {
  //           collateralBalanceBefore1 = await getBalance(authorized)
  //         } else {
  //           collateralBalanceBefore1 = await _token.balanceOf(authorized)
  //         }

  //         // Seller 2
  //         let collateralBalanceBefore2
  //         if (collateralToken === ETH) {
  //           collateralBalanceBefore2 = await getBalance(authorized2)
  //         } else {
  //           collateralBalanceBefore2 = await _token.balanceOf(authorized2)
  //         }

  //         // Seller 1
  //         let { firstApprove, secondApprove, sellReceipt } = await sellSomeAmount({
  //           curve,
  //           token,
  //           address: authorized,
  //           collateralToken,
  //           amount: firstAmount.toString(10),
  //         })
  //         const firstApprove1 = firstApprove
  //         const secondApprove1 = secondApprove
  //         const sellReceipt1 = sellReceipt

  //         const firstApproveGas1 = new web3.BigNumber(firstApprove1.receipt.gasUsed)
  //         const secondApproveGas1 = new web3.BigNumber(secondApprove1.receipt.gasUsed)
  //         const sellGas1 = new web3.BigNumber(sellReceipt1.receipt.gasUsed)

  //         let NewSellOrder1 = sellReceipt1.logs.find(l => l.event === 'NewSellOrder')
  //         let sellBatchNumber = NewSellOrder1 ? NewSellOrder1.args.batchId.toNumber() : new Error('No Buy Order')

  //         // Seller 2
  //         const { firstApprove2, secondApprove2, sellReceipt2 } = await (async () => {
  //           let { firstApprove, secondApprove, sellReceipt } = await sellSomeAmount({
  //             curve,
  //             token,
  //             address: authorized2,
  //             collateralToken,
  //             amount: secondAmount.toString(10),
  //           })
  //           return {
  //             firstApprove2: firstApprove,
  //             secondApprove2: secondApprove,
  //             sellReceipt2: sellReceipt,
  //           }
  //         })()

  //         assert(firstApprove1.tx !== firstApprove2.tx, "txs shouldn't match (1)")
  //         assert(secondApprove1.tx !== secondApprove2.tx, "txs shouldn't match (2)")
  //         assert(sellReceipt1.tx !== sellReceipt2.tx, "txs shouldn't match (3)")

  //         const firstApproveGas2 = new web3.BigNumber(firstApprove2.receipt.gasUsed)
  //         const secondApproveGas2 = new web3.BigNumber(secondApprove2.receipt.gasUsed)
  //         const sellGas2 = new web3.BigNumber(sellReceipt2.receipt.gasUsed)

  //         let NewSellOrder2 = sellReceipt2.logs.find(l => l.event === 'NewSellOrder')
  //         let sellBatchNumber2 = NewSellOrder2 ? NewSellOrder2.args.batchId.toNumber() : new Error('No Buy Order')

  //         assert(sellBatchNumber === sellBatchNumber2, `Sell batches don't match ${sellBatchNumber} ${sellBatchNumber2}`)

  //         // clear batches and count the money
  //         await increaseBlocks(BLOCKS_IN_BATCH)

  //         // execute from root account so the gas costs don't need to be calculated
  //         await curve.clearBatches({ from: root })
  //         await curve.claimSell(authorized, collateralToken, sellBatchNumber, { from: root })
  //         await curve.claimSell(authorized2, collateralToken, sellBatchNumber, { from: root })

  //         // Seller 1
  //         let collateralBalanceAfter1
  //         if (collateralToken === ETH) {
  //           let gasSpent1 = sellGas1.plus(firstApproveGas1).plus(secondApproveGas1)
  //           collateralBalanceAfter1 = await getBalance(authorized)
  //           collateralBalanceAfter1 = collateralBalanceAfter1.plus(gasSpent1.mul(gasCost))
  //         } else {
  //           collateralBalanceAfter1 = await _token.balanceOf(authorized)
  //         }
  //         const netGain1 = collateralBalanceAfter1.sub(collateralBalanceBefore1)

  //         let numerator = netGain1.gt(estimatedFirstReturn) ? estimatedFirstReturn : netGain1
  //         let denominator = netGain1.gt(estimatedFirstReturn) ? netGain1 : estimatedFirstReturn
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Didn't receive as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} for seller1 netGain1: ${netGain1.toString(
  //             10
  //           )} estimatedFirstReturn: ${estimatedFirstReturn.toString(10)} percentageOffset: ${percentageOffset.toString(10)}`
  //         )

  //         // Seller 2
  //         let collateralBalanceAfter2
  //         if (collateralToken === ETH) {
  //           let gasSpent2 = sellGas2.plus(firstApproveGas2).plus(secondApproveGas2)
  //           collateralBalanceAfter2 = await getBalance(authorized2)
  //           collateralBalanceAfter2 = collateralBalanceAfter2.plus(gasSpent2.mul(gasCost))
  //         } else {
  //           collateralBalanceAfter2 = await _token.balanceOf(authorized2)
  //         }
  //         const netGain2 = collateralBalanceAfter2.sub(collateralBalanceBefore2)

  //         numerator = netGain2.gt(estimatedSecondReturn) ? estimatedSecondReturn : netGain2
  //         denominator = netGain2.gt(estimatedSecondReturn) ? netGain2 : estimatedSecondReturn
  //         percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Didn't receive as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} for seller 2 netGain2: ${netGain2.toString(
  //             10
  //           )} estimatedSecondReturn: ${estimatedSecondReturn.toString(10)} percentageOffset: ${percentageOffset.toString(10)}`
  //         )
  //       })
  //     })

  //     context('> Buys & Sells', () => {
  //       it('it should match the estimate for equal buy and sells', async () => {
  //         // buy some tokens, either spend 5 ETH or some random amount of ERC20
  //         const amount = randomAmount()
  //         // the buy results in an amount called sellAmount, becuase it will be used for a sell soon.
  //         let sellAmount = await buyAndClaimTokens({
  //           token,
  //           curve,
  //           address: authorized,
  //           collateralToken,
  //           amount,
  //           from: authorized,
  //         })

  //         const actualTotalSupply = await token.totalSupply()
  //         const actualBalance = await controller.balanceOf(pool.address, collateralToken)

  //         // contract calculated virtualSupply and virtualBalance
  //         const currentPricePPM = await curve.getPricePPM(collateralToken, actualTotalSupply.toString(10), actualBalance.toString(10))

  //         // this is the amount a second user will spend to match the sellAmount
  //         const spendAmountAfterFee = new web3.BigNumber(
  //           sellAmount
  //             .mul(currentPricePPM)
  //             .div(PPM)
  //             .toString(10)
  //             .split('.')[0]
  //         )
  //         // an additional amount needs to be added for the fee
  //         // initialAmount = afterFeeAmount / (1-fee)
  //         const spendAmount = computeAmountBeforeBuyFee(spendAmountAfterFee).round(0)
  //         await progressToNextBatch()

  //         // the first user sells the original sell amount
  //         const { sellBatchNumber } = await sellSomeAmount({
  //           curve,
  //           token,
  //           address: authorized,
  //           collateralToken,
  //           amount: sellAmount.toString(10),
  //         })

  //         // the second user buys the original sell amount (with the addition of their fee)
  //         const buyBatchNumber = await buyToken({
  //           curve,
  //           address: authorized2,
  //           collateralToken,
  //           amount: spendAmount,
  //           from: authorized2,
  //         })
  //         assert(sellBatchNumber === buyBatchNumber, `sellBatchNumber  (${sellBatchNumber}) did not equal buyBatchNumber (${buyBatchNumber})`)

  //         await increaseBlocks(BLOCKS_IN_BATCH)
  //         await curve.clearBatches({ from: root })
  //         await curve.claimBuy(authorized2, collateralToken, buyBatchNumber, { from: root })
  //         await curve.claimSell(authorized, collateralToken, sellBatchNumber, { from: root })

  //         const balanceOfSeller = await token.balanceOf(authorized)
  //         const balanceOfBuyer = await token.balanceOf(authorized2)

  //         let numerator = balanceOfBuyer.gt(sellAmount) ? sellAmount : balanceOfBuyer
  //         let denominator = balanceOfBuyer.gt(sellAmount) ? balanceOfBuyer : sellAmount
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Buyer did not have original sellAmount. Expected ${sellAmount.toString(10)}, got ${balanceOfBuyer.toString(
  //             10
  //           )}, percentageOffset: ${percentageOffset.toString(10)}`
  //         )
  //         assert(balanceOfSeller.eq(0), `Seller did not get rid of all their tokens. Expected 0, got ${balanceOfSeller.toString(10)}`)
  //       })
  //       it('it should match the estimates on more sells than buys', async () => {
  //         const amount = randomAmount()
  //         let authorizedBalanceToken = await buyAndClaimTokens({
  //           token,
  //           curve,
  //           address: authorized,
  //           collateralToken,
  //           amount,
  //           from: authorized,
  //         })

  //         const sellAmountToken = authorizedBalanceToken.div(2)

  //         const actualTotalSupply = await token.totalSupply()
  //         const actualBalance = await controller.balanceOf(pool.address, collateralToken)
  //         // virtualSupply and virtualBalance included contract-side
  //         const currentPricePPM = await curve.getPricePPM(collateralToken, actualTotalSupply.toString(10), actualBalance.toString(10))
  //         const matchSellAmountCollateral = sellAmountToken.mul(currentPricePPM).div(PPM)

  //         const matchSellAmountCollaterlAfterSellFee = matchSellAmountCollateral.minus(computeSellFee(matchSellAmountCollateral))
  //         const matchSellAmountCollateralIncludingFee = computeAmountBeforeBuyFee(matchSellAmountCollateral)

  //         await progressToNextBatch()

  //         let sellersCollateralBalanceBefore
  //         if (collateralToken === ETH) {
  //           sellersCollateralBalanceBefore = await getBalance(authorized)
  //         } else {
  //           sellersCollateralBalanceBefore = await _token.balanceOf(authorized)
  //         }

  //         const { firstApprove, secondApprove, sellReceipt, sellBatchNumber } = await sellSomeAmount({
  //           curve,
  //           token,
  //           address: authorized,
  //           collateralToken,
  //           amount: sellAmountToken.floor(0),
  //         })
  //         const buyBatchNumber = await buyToken({
  //           curve,
  //           address: authorized2,
  //           collateralToken,
  //           amount: matchSellAmountCollateralIncludingFee.floor(0),
  //           from: authorized2,
  //         })
  //         assert(sellBatchNumber === buyBatchNumber, `sellBatchNumber  (${sellBatchNumber}) did not equal buyBatchNumber (${buyBatchNumber})`)

  //         await increaseBlocks(BLOCKS_IN_BATCH)
  //         await curve.clearBatches({ from: root })
  //         await curve.claimBuy(authorized2, collateralToken, buyBatchNumber, { from: root })
  //         await curve.claimSell(authorized, collateralToken, sellBatchNumber, { from: root })
  //         const balanceOfBuyer = await token.balanceOf(authorized2)

  //         let numerator = balanceOfBuyer.gt(sellAmountToken) ? sellAmountToken : balanceOfBuyer
  //         let denominator = balanceOfBuyer.gt(sellAmountToken) ? balanceOfBuyer : sellAmountToken
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Buyer did not have original sellAmountToken. Expected ${sellAmountToken.toString(10)}, got ${balanceOfBuyer.toString(
  //             10
  //           )} with percentageOffset ${percentageOffset.toString(10)}`
  //         )

  //         let sellersCollateralBalanceAfter
  //         if (collateralToken === ETH) {
  //           sellersCollateralBalanceAfter = await getBalance(authorized)
  //           sellersCollateralBalanceAfter = sellersCollateralBalanceAfter
  //             .plus(new web3.BigNumber(firstApprove.receipt.gasUsed).mul(gasCost))
  //             .plus(new web3.BigNumber(secondApprove.receipt.gasUsed).mul(gasCost))
  //             .plus(new web3.BigNumber(sellReceipt.receipt.gasUsed).mul(gasCost))
  //         } else {
  //           sellersCollateralBalanceAfter = await _token.balanceOf(authorized)
  //         }

  //         const sellersProfit = sellersCollateralBalanceAfter.sub(sellersCollateralBalanceBefore)

  //         numerator = sellersProfit.gt(matchSellAmountCollaterlAfterSellFee) ? matchSellAmountCollaterlAfterSellFee : sellersProfit
  //         denominator = sellersProfit.gt(matchSellAmountCollaterlAfterSellFee) ? sellersProfit : matchSellAmountCollaterlAfterSellFee
  //         percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Seller did not get rid of their tokens. Expected ${matchSellAmountCollaterlAfterSellFee.toString(10)}, got ${sellersProfit.toString(10)}`
  //         )
  //       })

  //       it('it should match the estimates on more buys than sells', async () => {
  //         const amount = randomAmount()
  //         let authorizedBalance = await buyAndClaimTokens({
  //           token,
  //           curve,
  //           address: authorized,
  //           collateralToken,
  //           amount,
  //           from: authorized,
  //         })

  //         const sellAmountToken = authorizedBalance.div(2)

  //         const actualTotalSupply = await token.totalSupply()
  //         const actualBalance = await controller.balanceOf(pool.address, collateralToken)
  //         // contract calculated virtualSupply and virtualBalance
  //         const currentPricePPM = await curve.getPricePPM(collateralToken, actualTotalSupply.toString(10), actualBalance.toString(10))
  //         // if authorized were to sell half their balance (sellAmountToken) at the current price
  //         // they would receive sellAmountMatch of collateralToken
  //         const matchSellAmountCollateral = sellAmountToken.mul(currentPricePPM).div(PPM)
  //         const matchSellAmountCollateralWithFee = computeAmountBeforeBuyFee(matchSellAmountCollateral)
  //         const matchSellAmountCollaterlAfterSellFee = matchSellAmountCollateral.minus(computeSellFee(matchSellAmountCollateral))

  //         const combinedTotalSupply = actualTotalSupply.add(totalSupply)
  //         const combinedBalance = actualBalance.add(balance)

  //         // if authorized2 were to buy the sellAmountToken of Tokens at the current price
  //         // plus some amount of tokens beyond that, it would be calculated by the bonding curve.
  //         const buyBeyondMatchCollateral = randomAmount()
  //         const buyBeyondMatchCollateralAfterFee = buyBeyondMatchCollateral.minus(computeBuyFee(buyBeyondMatchCollateral))
  //         let resultOfBondingCurveBuyToken = getBuy({
  //           amount: buyBeyondMatchCollateralAfterFee,
  //           totalSupply: combinedTotalSupply,
  //           balance: combinedBalance,
  //           reserveRatio,
  //         })
  //         const totalBuyCollateral = buyBeyondMatchCollateral.plus(matchSellAmountCollateralWithFee)

  //         // the totalResultOfBuy for the buyer would be the matched amount plus the result of the bonding curve buy
  //         const totalResultOfBuyToken = sellAmountToken.plus(resultOfBondingCurveBuyToken.bancor.toString(10))

  //         let sellersCollateralBalanceBefore
  //         if (collateralToken === ETH) {
  //           sellersCollateralBalanceBefore = await getBalance(authorized)
  //         } else {
  //           sellersCollateralBalanceBefore = await _token.balanceOf(authorized)
  //         }

  //         await progressToNextBatch()
  //         const { firstApprove, secondApprove, sellReceipt, sellBatchNumber } = await sellSomeAmount({
  //           curve,
  //           token,
  //           address: authorized,
  //           collateralToken,
  //           amount: sellAmountToken.toString(10),
  //         })
  //         const buyBatchNumber = await buyToken({
  //           curve,
  //           address: authorized2,
  //           collateralToken,
  //           amount: totalBuyCollateral.floor(0).toString(10),
  //           from: authorized2,
  //         })
  //         assert(sellBatchNumber === buyBatchNumber, `sellBatchNumber  (${sellBatchNumber}) did not equal buyBatchNumber (${buyBatchNumber})`)

  //         await increaseBlocks(BLOCKS_IN_BATCH)
  //         await curve.clearBatches({ from: root })
  //         await curve.claimBuy(authorized2, collateralToken, buyBatchNumber, { from: root })
  //         await curve.claimSell(authorized, collateralToken, sellBatchNumber, { from: root })

  //         let sellersCollateralBalanceAfter
  //         if (collateralToken === ETH) {
  //           sellersCollateralBalanceAfter = await getBalance(authorized)
  //           sellersCollateralBalanceAfter = sellersCollateralBalanceAfter
  //             .plus(new web3.BigNumber(firstApprove.receipt.gasUsed).mul(gasCost))
  //             .plus(new web3.BigNumber(secondApprove.receipt.gasUsed).mul(gasCost))
  //             .plus(new web3.BigNumber(sellReceipt.receipt.gasUsed).mul(gasCost))
  //         } else {
  //           sellersCollateralBalanceAfter = await _token.balanceOf(authorized)
  //         }

  //         const balanceOfBuyer = await token.balanceOf(authorized2)

  //         let numerator = balanceOfBuyer.gt(totalResultOfBuyToken) ? totalResultOfBuyToken : balanceOfBuyer
  //         let denominator = balanceOfBuyer.gt(totalResultOfBuyToken) ? balanceOfBuyer : totalResultOfBuyToken
  //         let percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Buyer did not have original sellAmountToken. Expected ${totalResultOfBuyToken.toString(10)}, got ${balanceOfBuyer.toString(
  //             10
  //           )} with percentageOffset ${percentageOffset.toString(10)}`
  //         )

  //         const sellersProfit = sellersCollateralBalanceAfter.sub(sellersCollateralBalanceBefore)

  //         numerator = sellersProfit.gt(matchSellAmountCollaterlAfterSellFee) ? matchSellAmountCollaterlAfterSellFee : sellersProfit
  //         denominator = sellersProfit.gt(matchSellAmountCollaterlAfterSellFee) ? sellersProfit : matchSellAmountCollaterlAfterSellFee
  //         percentageOffset = numerator.div(denominator)

  //         assert(
  //           percentageOffset.gt(percentageOffsetErrorMargin),
  //           `Seller did not get rid of their tokens. Expected ${matchSellAmountCollaterlAfterSellFee.toString(10)}, got ${sellersProfit.toString(10)}`
  //         )
  //       })
  //     })
  //   })
  // })
  // #endregion
})

function increaseBlocks(blocks) {
  if (typeof blocks === 'object') {
    blocks = blocks.toNumber(10)
  }
  return new Promise((resolve, reject) => {
    increaseBlock().then(() => {
      blocks -= 1
      if (blocks === 0) {
        resolve()
      } else {
        increaseBlocks(blocks).then(resolve)
      }
    })
  })
}

function increaseBlock() {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync(
      {
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: 12345,
      },
      (err, result) => {
        if (err) reject(err)
        resolve(result)
      }
    )
  })
}

async function sellSomeAmount({ token, curve, address, collateralToken, amount }) {
  let firstApprove = await token.approve(curve.address, 0, {
    from: address,
    gasCost,
  })
  let secondApprove = await token.approve(curve.address, amount, {
    from: address,
    gasCost,
  })
  const sellReceipt = await curve.createSellOrder(address, collateralToken, amount, {
    from: address,
    gasCost,
  })

  let NewSellOrder = sellReceipt.logs.find(l => l.event === 'NewSellOrder')
  let sellBatchNumber = NewSellOrder ? NewSellOrder.args.batchId.toNumber() : new Error('No Sell Order')

  return {
    firstApprove,
    secondApprove,
    sellReceipt,
    sellBatchNumber,
  }
}

async function sellHalfAsMuchAsPossible({ token, curve, address, collateralToken }) {
  let balanceOf = await token.balanceOf(address)
  let half = balanceOf.div(2)
  let firstApprove = await token.approve(curve.address, 0, {
    from: address,
  })
  let secondApprove = await token.approve(curve.address, half, {
    from: address,
  })
  const sellReceipt = await curve.createSellOrder(address, collateralToken, half, {
    from: address,
  })

  let NewSellOrder = sellReceipt.logs.find(l => l.event === 'NewSellOrder')
  let sellBatchNumber = NewSellOrder ? NewSellOrder.args.batchId.toNumber() : new Error('No Sell Order')

  return {
    firstApprove,
    secondApprove,
    sellReceipt,
    sellBatchNumber,
  }
}

async function buyAndClaimTokens({ token, curve, address, collateralToken, amount, from }) {
  from = from || address
  const batchId = await buyToken({
    curve,
    address,
    collateralToken,
    amount,
    from,
  })
  await increaseBlocks(BLOCKS_IN_BATCH)
  // if (DEBUG) await printBatch(batchId)
  await curve.clearBatches()
  await claimToken({
    curve,
    batchId,
    collateralToken,
    address,
  })
  return token.balanceOf(from)
}

async function buyToken({ curve, address, collateralToken, amount, from }) {
  if (!from) from = address
  let value = collateralToken === NULL_ADDRESS ? new web3.BigNumber(amount.toString(10)) : new web3.BigNumber(0)
  const _receipt = await curve.createBuyOrder(address, collateralToken, amount, {
    from,
    value,
  })
  const NewBuyOrder = _receipt.logs.find(l => l.event === 'NewBuyOrder')
  return NewBuyOrder ? NewBuyOrder.args.batchId.toNumber() : new Error('No Buy Order')
}

async function claimToken({ curve, batchId, collateralToken, address }) {
  let tx = await curve.claimBuy(address, collateralToken, batchId)
  printBuy(tx)
  return tx
}

function getMarginOfError({ totalSupply, balance }) {
  if (typeof totalSupply !== 'object') {
    totalSupply = new Decimal(totalSupply)
  }
  if (typeof balance !== 'object') {
    balance = new Decimal(balance)
  }

  const averageSquareRootLength = totalSupply
    .plus(balance)
    .div(2)
    .sqrt()
    .toFixed(0)
    .toString(10).length

  return new Decimal(10).pow(new Decimal(1).mul(averageSquareRootLength))
}

function getSell({ totalSupply, balance, reserveRatio, amount }) {
  totalSupply = new Decimal(totalSupply.toString(10))
  balance = new Decimal(balance.toString(10))
  reserveRatio = new Decimal(reserveRatio.toString(10))
  amount = new Decimal(amount.toString(10))
  // from bancor contract
  // Return = _connectorBalance * (1 - (1 - _sellAmount / _supply) ^ (1 / (_connectorWeight / 1000000)))
  let bancor = balance.mul(new Decimal(1).sub(new Decimal(1).sub(amount.div(totalSupply)).pow(new Decimal(1).div(reserveRatio))))

  // slope integral showing cost in collateral to mint k new tokens
  // can be used with inital tokenSupply as currentToken supply minus amount
  // and k as amount
  // Slope integral from https://blog.relevant.community/bonding-curves-in-depth-intuition-parametrization-d3905a681e0a
  // formula for m & n from https://medium.com/@billyrennekamp/converting-between-bancor-and-bonding-curve-price-formulas-9c11309062f5

  // collateral = (m / (n + 1)) * (s ^ (n + 1)) * ( ((1 + k/s) ^ (n + 1)) - 1)
  let n = new Decimal(1).div(reserveRatio).sub(1)
  let m = balance.mul(n.plus(1)).div(totalSupply.pow(n.plus(1)))
  let s = totalSupply.sub(amount)
  let k = amount
  let slope = m
    .div(n.plus(1))
    .mul(s.pow(n.plus(1)))
    .mul(
      k
        .div(s)
        .plus(1)
        .pow(n.plus(1))
        .sub(1)
    )
  return {
    bancor: new web3.BigNumber(bancor.toString(10)),
    slope: new web3.BigNumber(slope.toString(10)),
    m: new web3.BigNumber(m.toString(10)),
    n: new web3.BigNumber(n.toString(10)),
  }
}

function getBuy({ totalSupply, balance, reserveRatio, amount }) {
  totalSupply = new Decimal(totalSupply.toString(10))
  balance = new Decimal(balance.toString(10))
  reserveRatio = new Decimal(reserveRatio.toString(10))
  amount = new Decimal(amount.toString(10))
  // // Straight from bancor contract
  // // Return = _supply * ((1 + _depositAmount / _connectorBalance) ^ (_connectorWeight / 1000000) - 1)
  // let bancorClassic = totalSupply.mul(
  //   (new Decimal(1)).plus(
  //     amount.div(balance)
  //   ).pow(
  //     reserveRatio
  //   ).sub(
  //     new Decimal(1)
  //   )
  // )

  // slope integral from https://blog.relevant.community/bonding-curves-in-depth-intuition-parametrization-d3905a681e0a
  // formula for m & n from https://medium.com/@billyrennekamp/converting-between-bancor-and-bonding-curve-price-formulas-9c11309062f5

  // k = s(( ( p (n + 1) ) / (m * s^(n+1)) ) + 1)* (1 / (n + 1)) - 1)
  let one = new Decimal('1')
  let n = one.div(reserveRatio.toString(10))
  n = n.sub(1)
  const m = balance.mul(n.plus(1)).div(totalSupply.pow(n.plus(1)))

  const slope = totalSupply.mul(
    amount
      .mul(n.plus(1))
      .div(m.mul(totalSupply.pow(n.plus(1))))
      .plus(1)
      .pow(new Decimal(1).div(n.plus(1)))
      .sub(1)
  )

  // bancor formula from white paper
  // buyAmt = tokenSupply * ((1 + amtPaid / collateral)^CW—1)
  const bancor = totalSupply.mul(
    new Decimal(1)
      .plus(amount.div(balance))
      .pow(reserveRatio)
      .sub(1)
  )

  return {
    bancor: new web3.BigNumber(bancor.toString(10)),
    slope: new web3.BigNumber(slope.toString(10)),
    m: new web3.BigNumber(m.toString(10)),
    n: new web3.BigNumber(n.toString(10)),
  }
}
function printSell(tx) {
  // console.log({ sell: tx.receipt.gasUsed })
}
function printBuy(tx) {
  // console.log({ buy: tx.receipt.gasUsed })
}
