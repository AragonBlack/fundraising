/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const assertEvent = require('@aragon/test-helpers/assertEvent')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
// const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
// const getBalance = require('@aragon/test-helpers/balance')(web3)
const { hash } = require('eth-ens-namehash')
const forEach = require('mocha-each')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const Controller = artifacts.require('SimpleMarketMakerController')
const TokenManager = artifacts.require('TokenManager')
const Agent = artifacts.require('Agent')
const Formula = artifacts.require('BancorFormula.sol')
const BancorMarketMaker = artifacts.require('BatchedBancorMarketMaker')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')

let BLOCKS_IN_BATCH = 10

const progressToNextBatch = require('@ablack/fundraising-test-helpers/progressToNextBatch')(web3, BLOCKS_IN_BATCH)
const getBalance = require('@ablack/fundraising-test-helpers/getBalance')(web3, TokenMock)

const { NULL_ADDRESS } = require('@ablack/fundraising-test-helpers/addresses')

// const getEvent = (receipt, event, arg) => {
//   return receipt.logs.filter(l => l.event === event)[0].args[arg]
// }

// const getBuyOrderBatchId = receipt => {
//   const event = receipt.logs.find(l => l.event === 'NewBuyOrder')
//   return event.args.batchId
// }

// const getNewMetaBatchEvent = receipt => {
//   return receipt.logs.find(l => l.event === 'NewMetaBatch').args
// }

// const getNewBatchEvent = receipt => {
//   return receipt.logs.find(l => l.event === 'NewBatch').args
// }

// const getSellOrderBatchId = receipt => {
//   const event = receipt.logs.find(l => l.event === 'NewSellOrder')
//   return event.args.batchId
// }

const { getEvent, getNewMetaBatchEvent, getNewBatchEvent, getBuyOrderBatchId, getSellOrderBatchId } = require('@ablack/fundraising-test-helpers/events')

// const randomVirtualSupply = () => {
//   return Math.floor(Math.random() * 9999) + 1
// }

// const randomVirtualBalance = () => {
//   return Math.floor(Math.random() * 9999) + 1
// }

// const randomReserveRatio = () => {
//   return Math.floor(Math.random() * 999999) + 1
// }

// const randomSlippage = () => {
//   const PCT_BASE = 1000000000000000000

//   return Math.floor(Math.random() * PCT_BASE) + 1
// }

const { randomAmount, randomVirtualSupply, randomVirtualBalance, randomReserveRatio, randomSlippage } = require('@ablack/fundraising-test-helpers/randomness')

contract('BatchedBancorMarketMaker app', accounts => {
  let factory, dao, acl, cBase, tBase, pBase, bBase, token, tokenManager, controller, pool, formula, curve, collateral, collaterals
  let ETH,
    APP_MANAGER_ROLE,
    MINT_ROLE,
    BURN_ROLE,
    ADD_COLLATERAL_TOKEN_ROLE,
    REMOVE_COLLATERAL_TOKEN_ROLE,
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

  const BUY_FEE_PERCENT = 100000000000000000 // 1%
  const SELL_FEE_PERCENT = 100000000000000000
  const MAXIMUM_SLIPPAGE = 10 * PCT_BASE // x10

  const VIRTUAL_SUPPLIES = [new web3.BigNumber(Math.pow(10, 23)), new web3.BigNumber(Math.pow(10, 22))]
  const VIRTUAL_BALANCES = [new web3.BigNumber(Math.pow(10, 22)), new web3.BigNumber(Math.pow(10, 20))]
  const RESERVE_RATIOS = [(PPM * 10) / 100, (PPM * 1) / 100]

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
    pool = await Agent.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
    // bancor-curve
    const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
    curve = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(curve.address, tokenManager.address, MINT_ROLE, root, { from: root })
    await acl.createPermission(curve.address, tokenManager.address, BURN_ROLE, root, { from: root })
    await acl.createPermission(curve.address, pool.address, TRANSFER_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, REMOVE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_FORMULA_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_FEES_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, OPEN_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, OPEN_SELL_ORDER_ROLE, root, { from: root })
    await acl.grantPermission(authorized2, curve.address, ADD_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, REMOVE_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_BENEFICIARY_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_FORMULA_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_FEES_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, OPEN_BUY_ORDER_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, OPEN_SELL_ORDER_ROLE, { from: root })
    // collaterals
    collateral = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE * 2)
    await collateral.transfer(authorized2, INITIAL_TOKEN_BALANCE, { from: authorized })
    collaterals = [ETH, collateral.address]
    // allowances
    await collateral.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await collateral.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized2 })
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
      SELL_FEE_PERCENT
    )
    // end up initializing market maker
    await curve.addCollateralToken(ETH, VIRTUAL_SUPPLIES[0], VIRTUAL_BALANCES[0], RESERVE_RATIOS[0], MAXIMUM_SLIPPAGE, { from: authorized })
    await curve.addCollateralToken(collateral.address, VIRTUAL_SUPPLIES[1], VIRTUAL_BALANCES[1], RESERVE_RATIOS[1], MAXIMUM_SLIPPAGE, { from: authorized })
    // make sure tests start at the beginning of a new batch
    await progressToNextBatch()
  }

  const BN = amount => {
    return new web3.BigNumber(amount)
  }

  const purchaseReturn = async (index, supply, balance, amount) => {
    supply = new web3.BigNumber(supply.toString(10))
    balance = new web3.BigNumber(balance.toString(10))
    amount = new web3.BigNumber(amount.toString(10))

    return formula.calculatePurchaseReturn(VIRTUAL_SUPPLIES[index].add(supply), VIRTUAL_BALANCES[index].add(balance), RESERVE_RATIOS[index], amount)
  }

  const saleReturn = async (index, supply, balance, amount) => {
    supply = new web3.BigNumber(supply.toString(10))
    balance = new web3.BigNumber(balance.toString(10))
    amount = new web3.BigNumber(amount.toString(10))

    return formula.calculateSaleReturn(VIRTUAL_SUPPLIES[index].add(supply), VIRTUAL_BALANCES[index].add(balance), RESERVE_RATIOS[index], amount)
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
    let [initialized, cancelled, supply, balance, reserveRatio, totalBuySpend, totalBuyReturn, totalSellSpend, totalSellReturn] = await curve.getBatch(
      batchNumber,
      collateralToken
    )
    return {
      initialized,
      cancelled,
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
    const [whitelisted, virtualSupply, virtualBalance, reserveRatio, slippage] = await curve.getCollateralToken(collateral)

    return { whitelisted, virtualSupply, virtualBalance, reserveRatio, slippage }
  }

  const openBuyOrder = async (buyer, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : buyer
    const value = collateral === ETH ? (opts && opts.value ? opts.value : amount) : opts && opts.value ? opts.value : 0
    const receipt = await curve.openBuyOrder(buyer, collateral, amount, { from, value })

    return receipt
  }

  const openSellOrder = async (seller, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : seller
    const receipt = await curve.openSellOrder(seller, collateral, amount, { from })

    return receipt
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

  const openClaimAndSellBuyOrder = async (buyer, collateral, amount, opts = {}) => {
    const _balance = await openAndClaimBuyOrder(buyer, collateral, amount, opts)

    return openSellOrder(buyer, collateral, _balance, opts)
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
    cBase = await Controller.new()
    tBase = await TokenManager.new()
    pBase = await Agent.new()
    bBase = await BancorMarketMaker.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
    MINT_ROLE = await tBase.MINT_ROLE()
    BURN_ROLE = await tBase.BURN_ROLE()
    ADD_COLLATERAL_TOKEN_ROLE = await bBase.ADD_COLLATERAL_TOKEN_ROLE()
    REMOVE_COLLATERAL_TOKEN_ROLE = await bBase.REMOVE_COLLATERAL_TOKEN_ROLE()
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
  context('> #deploy', () => {
    it('> it should deploy', async () => {
      await BancorMarketMaker.new()
    })
  })
  // #endregion

  // #region initialize
  context('> #initialize', () => {
    context('> initialization parameters are correct', () => {
      it('it should initialize bancor market maker', async () => {
        assert.equal(await curve.controller(), controller.address)
        assert.equal(await curve.tokenManager(), tokenManager.address)
        assert.equal(await curve.token(), token.address)
        assert.equal(await curve.reserve(), pool.address)
        assert.equal(await curve.beneficiary(), beneficiary)
        assert.equal(await curve.formula(), formula.address)
        assert.equal(await curve.batchBlocks(), BLOCKS_IN_BATCH)
        assert.equal(await curve.buyFeePct(), BUY_FEE_PERCENT)
        assert.equal(await curve.sellFeePct(), SELL_FEE_PERCENT)
      })
    })

    context('> initialization parameters are not correct', () => {
      it('it should revert [controller is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(
            authorized,
            tokenManager.address,
            pool.address,
            beneficiary,
            formula.address,
            BLOCKS_IN_BATCH,
            BUY_FEE_PERCENT,
            SELL_FEE_PERCENT,
            { from: root }
          )
        )
      })

      it('it should revert [token manager is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(
            controller.address,
            authorized,
            pool.address,
            beneficiary,
            formula.address,
            BLOCKS_IN_BATCH,
            BUY_FEE_PERCENT,
            SELL_FEE_PERCENT,
            { from: root }
          )
        )
      })

      it('it should revert [pool is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(
            controller.address,
            tokenManager.address,
            authorized,
            beneficiary,
            formula.address,
            BLOCKS_IN_BATCH,
            BUY_FEE_PERCENT,
            SELL_FEE_PERCENT,
            {
              from: root,
            }
          )
        )
      })

      it('it should revert [formula is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(
            controller.address,
            tokenManager.address,
            pool.address,
            beneficiary,
            authorized,
            BLOCKS_IN_BATCH,
            BUY_FEE_PERCENT,
            SELL_FEE_PERCENT,
            {
              from: root,
            }
          )
        )
      })

      it('it should revert [batchBlocks is zero]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(controller.address, tokenManager.address, pool.address, beneficiary, formula.address, 0, BUY_FEE_PERCENT, SELL_FEE_PERCENT, {
            from: root,
          })
        )
      })

      it('it should revert [buy fee is not a percentage]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(
            controller.address,
            tokenManager.address,
            pool.address,
            beneficiary,
            formula.address,
            BLOCKS_IN_BATCH,
            PCT_BASE,
            SELL_FEE_PERCENT,
            {
              from: root,
            }
          )
        )
      })

      it('it should revert [sell fee is not a percentage]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(
            controller.address,
            tokenManager.address,
            pool.address,
            beneficiary,
            formula.address,
            BLOCKS_IN_BATCH,
            BUY_FEE_PERCENT,
            PCT_BASE,
            {
              from: root,
            }
          )
        )
      })
    })

    it('it should revert on re-initialization', async () => {
      assertRevert(() =>
        curve.initialize(
          controller.address,
          tokenManager.address,
          pool.address,
          beneficiary,
          formula.address,
          BLOCKS_IN_BATCH,
          BUY_FEE_PERCENT,
          SELL_FEE_PERCENT,
          { from: root }
        )
      )
    })
  })
  // #endregion

  // #region addCollateralToken
  context('> #addCollateralToken', () => {
    context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      context('> and collateral token has not yet been added', () => {
        context('> and collateral token is ETH or ERC20 [i.e. contract]', () => {
          context('> and reserve ratio is valid', () => {
            it('it should add collateral token', async () => {
              const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

              const virtualSupply = randomVirtualSupply()
              const virtualBalance = randomVirtualBalance()
              const reserveRatio = randomReserveRatio()
              const slippage = randomSlippage()

              const receipt = await curve.addCollateralToken(unlisted.address, virtualSupply, virtualBalance, reserveRatio, slippage, { from: authorized })
              const collateral = await getCollateralToken(unlisted.address)

              assertEvent(receipt, 'AddCollateralToken')
              assert.equal(collateral.whitelisted, true)
              assert.equal(collateral.virtualSupply.toNumber(), virtualSupply)
              assert.equal(collateral.virtualBalance.toNumber(), virtualBalance)
              assert.equal(collateral.reserveRatio.toNumber(), reserveRatio)
              assert.equal(collateral.slippage.toNumber(), slippage)
            })
          })

          context('> but reserve ratio is not valid', () => {
            it('it should revert', async () => {
              const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

              await assertRevert(() =>
                curve.addCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), PPM + 1, randomSlippage(), { from: authorized })
              )
            })
          })
        })

        context('> but collateral token is not ETH or ERC20 [i.e. contract]', () => {
          it('it should revert', async () => {
            await assertRevert(() =>
              curve.addCollateralToken(authorized, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), { from: authorized })
            )
          })
        })
      })

      context('> but collateral token has already been added', () => {
        it('it should revert', async () => {
          await assertRevert(() =>
            curve.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), { from: authorized })
          )
        })
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

        await assertRevert(() =>
          curve.addCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), {
            from: unauthorized,
          })
        )
      })
    })
  })
  // #endregion

  // #region removeCollateralToken
  context('> #removeCollateralToken', () => {
    context('> sender has REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      context('> and collateral token is whitelisted', () => {
        it('it should remove collateral token', async () => {
          const receipt = await curve.removeCollateralToken(collateral.address, { from: authorized })
          const collateral = await getCollateralToken(collateral.address)

          assertEvent(receipt, 'RemoveCollateralToken')
          assert.equal(collateral.whitelisted, false)
          assert.equal(collateral.virtualSupply.toNumber(), 0)
          assert.equal(collateral.virtualBalance.toNumber(), 0)
          assert.equal(collateral.reserveRatio.toNumber(), 0)
          assert.equal(collateral.slippage.toNumber(), 0)
        })

        it('it should cancel current batch', async () => {
          const _balance = await openAndClaimBuyOrder(authorized, collateral.address, randomAmount(), { from: authorized })

          const amount = randomAmount()
          const fee = computeBuyFee(amount)
          await openBuyOrder(authorized, collateral.address, amount, { from: authorized })
          await openSellOrder(authorized, collateral.address, _balance, { from: authorized })
          await curve.removeCollateralToken(collateral.address, { from: authorized })

          const batchId = await curve.getCurrentBatchId()
          const batch = await getBatch(batchId, collateral.address)

          const tokensToBeMinted = await curve.tokensToBeMinted()
          const collateralsToBeClaimed = await curve.collateralsToBeClaimed(collateral.address)

          assert.equal(batch.cancelled, true)
          assert.equal(tokensToBeMinted.toNumber(), _balance.toNumber())
          assert.equal(collateralsToBeClaimed.toNumber(), amount.minus(fee).toNumber())
        })
      })

      context('> but collateral token is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

          await assertRevert(() => curve.removeCollateralToken(unlisted.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => curve.removeCollateralToken(collateral.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateCollateralToken
  context('> #updateCollateralToken', () => {
    context('> sender has UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      context('> and collateral token is whitelisted', () => {
        context('> and reserve ratio is valid', () => {
          it('it should update collateral token', async () => {
            const virtualSupply = randomVirtualSupply()
            const virtualBalance = randomVirtualBalance()
            const reserveRatio = randomReserveRatio()
            const slippage = randomSlippage()

            const receipt = await curve.updateCollateralToken(collateral.address, virtualSupply, virtualBalance, reserveRatio, slippage, { from: authorized })
            const collateral = await getCollateralToken(collateral.address)

            assertEvent(receipt, 'UpdateCollateralToken')
            assert.equal(collateral.whitelisted, true)
            assert.equal(collateral.virtualSupply.toNumber(), virtualSupply)
            assert.equal(collateral.virtualBalance.toNumber(), virtualBalance)
            assert.equal(collateral.reserveRatio.toNumber(), reserveRatio)
            assert.equal(collateral.slippage.toNumber(), slippage)
          })
        })

        context('> but reserve ratio is not valid', () => {
          it('it should revert', async () => {
            await assertRevert(() =>
              curve.updateCollateralToken(collateral.address, randomVirtualSupply(), randomVirtualBalance(), PPM + 1, randomSlippage(), { from: authorized })
            )
          })
        })
      })

      context('> but collateral token is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

          await assertRevert(() =>
            curve.updateCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), {
              from: authorized,
            })
          )
        })
      })
    })

    context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          curve.updateCollateralToken(collateral.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), {
            from: unauthorized,
          })
        )
      })
    })
  })
  // #endregion

  // #region updateBeneficiary
  context('> #updateBeneficiary', () => {
    context('> sender has UPDATE_BENEFICIARY_ROLE', () => {
      context('> and beneficiary is valid', () => {
        it('it should update beneficiary', async () => {
          const receipt = await curve.updateBeneficiary(root, { from: authorized })

          assertEvent(receipt, 'UpdateBeneficiary')
          assert.equal(await curve.beneficiary(), root)
        })
      })

      context('> but beneficiary is not valid', () => {
        it('it should revert', async () => {
          await assertRevert(() => curve.updateBeneficiary(NULL_ADDRESS, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_BENEFICIARY_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => curve.updateBeneficiary(root, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateFormula
  context('> #updateFormula', () => {
    context('> sender has UPDATE_FORMULA_ROLE', () => {
      context('> and new formula is a contract', () => {
        it('it should update formula', async () => {
          const _formula = await Formula.new()
          const receipt = await curve.updateFormula(_formula.address, { from: authorized })

          assertEvent(receipt, 'UpdateFormula')
          assert.equal(await curve.formula(), _formula.address)
        })
      })

      context('> but new formula is not a contract', () => {
        it('it should revert', async () => {
          await assertRevert(() => curve.updateFormula(root, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_FORMULA_ROLE', () => {
      it('it should revert', async () => {
        const _formula = await Formula.new()

        await assertRevert(() => curve.updateFormula(_formula.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateFees
  context('> #updateFees', () => {
    context('> sender has UPDATE_FEES_ROLE', () => {
      context('> and new fees are valid', () => {
        it('it should update fees', async () => {
          const receipt = await curve.updateFees(40, 50, { from: authorized })

          assertEvent(receipt, 'UpdateFees')
          assert.equal((await curve.buyFeePct()).toNumber(), 40)
          assert.equal((await curve.sellFeePct()).toNumber(), 50)
        })
      })

      context('> but new fees are not valid', () => {
        it('it should revert [buy fee is not valid]', async () => {
          await assertRevert(() => curve.updateFees(PCT_BASE + 1, 50, { from: authorized }))
        })

        it('it should revert [sell fee is not valid]', async () => {
          await assertRevert(() => curve.updateFees(40, PCT_BASE + 1, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_FEES_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => curve.updateFees(40, 50, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openBuyOrder
  context('> #openBuyOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> sender has OPEN_BUY_ORDER_ROLE', () => {
        context('> and collateral is whitelisted', () => {
          context('> and batch is not cancelled', () => {
            context('> and value is not zero', () => {
              context('> and sender has sufficient funds', () => {
                context('> and no excess value is sent', () => {
                  context('> and order does not break maximum batch slippage', () => {
                    it('it should initialize new meta-batch [if needed]', async () => {
                      // let's initialize amounts for a first meta-batch
                      const amount = randomAmount()
                      const fee = computeBuyFee(amount)
                      const supply = await purchaseReturn(index, 0, 0, amount.minus(fee))
                      // let's initialize a first meta-batch
                      const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                      const metaBatch1 = getNewMetaBatchEvent(receipt1)
                      // let's move to the next meta-batch
                      await progressToNextBatch()
                      // let's initialize a second meta-batch
                      const receipt2 = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                      assertEvent(receipt2, 'NewMetaBatch')
                      const metaBatch2 = getNewMetaBatchEvent(receipt2)
                      // let's check the new meta-batch is properly initialized
                      assert.isAbove(metaBatch2.id.toNumber(), metaBatch1.id.toNumber())
                      assert.equal(metaBatch2.supply.toNumber(), supply.toNumber())
                    })

                    it('it should initialize new batch [if needed]', async () => {
                      // let's initialize amounts for a first batch
                      const amount = randomAmount()
                      const fee = computeBuyFee(amount)
                      const supply = await purchaseReturn(index, 0, 0, amount.minus(fee))
                      // let's initialize a first batch
                      const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                      const batch1 = getNewBatchEvent(receipt1)
                      // let's move to the next batch
                      await progressToNextBatch()
                      // let's initialize a second batch
                      const receipt2 = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                      assertEvent(receipt2, 'NewBatch')
                      const batchId = getBuyOrderBatchId(receipt2)
                      const batch2 = await getBatch(batchId, collaterals[index])
                      // let's check the new batch is properly initialized
                      assert.equal(batch2.initialized, true)
                      assert.equal(batch2.cancelled, false)
                      assert.isAbove(batchId.toNumber(), batch1.id.toNumber())
                      assert.equal(batch2.supply.toNumber(), VIRTUAL_SUPPLIES[index] + supply.toNumber())
                      assert.equal(batch2.balance.toNumber(), VIRTUAL_BALANCES[index] + amount.minus(fee).toNumber())
                      assert.equal(batch2.reserveRatio.toNumber(), RESERVE_RATIOS[index])
                    })

                    it('it should register buy order', async () => {
                      const receipt = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })

                      assertEvent(receipt, 'NewBuyOrder')
                    })

                    it('it should deduct fee', async () => {
                      const oldBalance = await getBalance(collaterals[index], beneficiary)
                      const amount = randomAmount()
                      const fee = computeBuyFee(amount)

                      await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                      const newBalance = await getBalance(collaterals[index], beneficiary)

                      assert.equal(newBalance.minus(oldBalance).toNumber(), fee.toNumber())
                    })

                    it('it should collect collateral', async () => {
                      const oldBalance = await getBalance(collaterals[index], pool.address)
                      const amount = randomAmount()
                      const fee = computeBuyFee(amount)

                      await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                      const newBalance = await getBalance(collaterals[index], pool.address)

                      assert.equal(newBalance.minus(oldBalance).toNumber(), amount.minus(fee).toNumber())
                    })

                    it('it should update batch', async () => {
                      const amount = randomAmount()
                      const fee = computeBuyFee(amount)
                      const purchase = await purchaseReturn(index, 0, 0, amount.minus(fee))

                      const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                      const batchId = getBuyOrderBatchId(receipt)
                      const batch = await getBatch(batchId, collaterals[index])

                      assert.equal(batch.totalBuySpend.toNumber(), amount.minus(fee).toNumber())
                      assert.equal(batch.totalBuyReturn.toNumber(), purchase.toNumber())
                      assert.equal(batch.totalSellSpend.toNumber(), 0)
                      assert.equal(batch.totalSellReturn.toNumber(), 0)
                    })

                    it('it should update the amount of tokens to be minted', async () => {
                      const amount = randomAmount()
                      const fee = computeBuyFee(amount)
                      const purchase = await purchaseReturn(index, 0, 0, amount.minus(fee))

                      await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                      const tokensToBeMinted = await curve.tokensToBeMinted()

                      assert.equal(tokensToBeMinted.toNumber(), purchase.toNumber())
                    })
                  })

                  context('> but order breaks maximum batch slippage', () => {
                    it('it should revert', async () => {
                      // let's set a small price slippage of 50%
                      await curve.updateCollateralToken(
                        collaterals[index],
                        VIRTUAL_SUPPLIES[index],
                        VIRTUAL_BALANCES[index],
                        RESERVE_RATIOS[index],
                        5 * Math.pow(10, 17),
                        { from: authorized }
                      )
                      // buy price for the first batch is about 1.39 for ETH and 1.43 for ERC20
                      // end price is about 1.86 for ETH and 1.97 for ERC20
                      const amount1 = new web3.BigNumber(1.1).mul(new web3.BigNumber(Math.pow(10, 18)))
                      // buy price for the second batch is about 2.82 for ETH and 3.11 for ERC20
                      const amount2 = new web3.BigNumber(3).mul(new web3.BigNumber(Math.pow(10, 18)))
                      // it should not revert
                      await openBuyOrder(authorized, collaterals[index], amount1, { from: authorized })
                      await progressToNextBatch()
                      // it should revert
                      await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount2, { from: authorized }))
                    })
                  })
                })

                context('> but excess value is sent', () => {
                  it('it should revert', async () => {
                    const amount = randomAmount()

                    await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount, { from: authorized, value: amount.add(1) })) // should revert both for ETH and ERC20
                  })
                })
              })

              context('> but sender does not have sufficient funds', () => {
                it('it should revert', async () => {
                  const amount = randomAmount()
                  // let's burn the the extra tokens to end up with a small balance
                  await collateral.transfer(unauthorized, INITIAL_TOKEN_BALANCE - amount, { from: authorized })

                  await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount.add(1), { from: authorized, value: amount.minus(1) })) // should revert both for ETH and ERC20
                })
              })
            })

            context('> but value is zero', () => {
              it('it should revert', async () => {
                await assertRevert(() => openBuyOrder(authorized, collaterals[index], 0, { from: authorized }))
              })
            })
          })

          context('> but batch is cancelled', () => {
            it('it should revert', async () => {
              await curve.removeCollateralToken(collaterals[index], { from: authorized })
              // current batch is now cancelled
              await assertRevert(() => openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized }))
            })
          })
        })

        context('> but collateral is not whitelisted', () => {
          it('it should revert', async () => {
            // we can't test un-whitelisted ETH unless we re-deploy a DAO without ETH as a whitelisted
            // collateral just for that use case it's not worth it because the logic is the same than ERC20 anyhow
            const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
            await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
            await assertRevert(() => openBuyOrder(authorized, unlisted.address, randomAmount(), { from: authorized }))
          })
        })
      })

      context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
        it('it should revert', async () => {
          await assertRevert(() => openBuyOrder(unauthorized, collaterals[index], randomAmount(), { from: unauthorized }))
        })
      })
    })
  })
  // #endregion

  // #region openSellOrder
  context('> #openSellOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> sender has OPEN_SELL_ORDER_ROLE', () => {
        context('> and collateral is whitelisted', () => {
          context('> and batch is not cancelled', () => {
            context('> and amount is not zero', () => {
              context('> and sender has sufficient funds', () => {
                context('> and order does not break maximum batch slippage', () => {
                  context('> and pool has sufficient funds', () => {
                    context('> and there is one order', () => {
                      it('it should initialize new meta-batch [if needed]', async () => {
                        // this will initialize a first meta-batch
                        const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                        const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                        assertEvent(receipt, 'NewMetaBatch')
                        const metaBatch = getNewMetaBatchEvent(receipt)

                        assert.isAbove(metaBatch.id.toNumber(), 0)
                        assert.equal(metaBatch.supply.toNumber(), _balance.toNumber())
                      })

                      it('it should initialize new batch [if needed]', async () => {
                        const amount = randomAmount()
                        const fee = computeBuyFee(amount)

                        const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })

                        assertEvent(receipt, 'NewBatch')
                        const batchId = getSellOrderBatchId(receipt)
                        const batch = await getBatch(batchId, collaterals[index])

                        assert.equal(batch.initialized, true)
                        assert.equal(batch.cancelled, false)
                        assert.isAbove(batchId.toNumber(), 0)
                        assert.equal(batch.supply.toNumber(), VIRTUAL_SUPPLIES[index] + _balance.toNumber())
                        assert.equal(batch.balance.toNumber(), VIRTUAL_BALANCES[index] + amount.minus(fee).toNumber())
                        assert.equal(batch.reserveRatio.toNumber(), RESERVE_RATIOS[index])
                      })

                      it('it should register sell order', async () => {
                        const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                        const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
                        assertEvent(receipt, 'NewSellOrder')
                      })

                      it('it should collect bonds', async () => {
                        const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                        await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
                        const newBalance = await getBalance(token.address, authorized)
                        assert.equal(newBalance.toNumber(), 0)
                      })

                      it('it should update batch', async () => {
                        const amount = randomAmount()
                        const fee = computeBuyFee(amount)
                        const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const _saleReturn = await saleReturn(index, _balance.toNumber(), amount.minus(fee).toNumber(), _balance)

                        const receipt = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
                        const batchId = getSellOrderBatchId(receipt)
                        const batch = await getBatch(batchId, collaterals[index])

                        assert.equal(batch.totalBuySpend.toNumber(), 0)
                        assert.equal(batch.totalBuyReturn.toNumber(), 0)
                        assert.equal(batch.totalSellSpend.toNumber(), _balance.toNumber())
                        assert.equal(batch.totalSellReturn.toNumber(), _saleReturn.toNumber())
                      })

                      it('it should update the amount of collateral to be claimed', async () => {
                        const amount = randomAmount()
                        const fee = computeBuyFee(amount)
                        const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const _saleReturn = await saleReturn(index, _balance.toNumber(), amount.minus(fee).toNumber(), _balance)

                        await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
                        const collateralToBeClaimed = await curve.collateralsToBeClaimed(collaterals[index])

                        assert.equal(collateralToBeClaimed.toNumber(), _saleReturn.toNumber())
                      })
                    })

                    context('> and there are multiple orders', () => {
                      it('it should batch orders', async () => {
                        // set amounts
                        const amountETH = new web3.BigNumber(5).mul(new web3.BigNumber(Math.pow(10, 18)))
                        const amountToken11 = new web3.BigNumber(3).mul(new web3.BigNumber(Math.pow(10, 18)))
                        const amountToken12 = new web3.BigNumber(3).mul(new web3.BigNumber(Math.pow(10, 18)))
                        const amountToken21 = new web3.BigNumber(4).mul(new web3.BigNumber(Math.pow(10, 18)))
                        // create and claim some buy orders
                        await openAndClaimBuyOrder(authorized, ETH, amountETH)
                        const balance1 = await openAndClaimBuyOrder(authorized, collateral.address, amountToken11)
                        const balance2 = await openAndClaimBuyOrder(authorized2, collateral.address, amountToken12)
                        // move to next batch
                        await progressToNextBatch()
                        // create some buy and sell orders
                        const third = balance1.div(3).round(0)
                        const receipt1 = await openSellOrder(authorized, ETH, third)
                        const receipt2 = await openSellOrder(authorized, collateral.address, third)
                        const receipt3 = await openBuyOrder(authorized, collateral.address, amountToken21)
                        const receipt4 = await openSellOrder(authorized2, ETH, balance2)
                        // assert that the orders have all been registered
                        assertEvent(receipt1, 'NewSellOrder')
                        assertEvent(receipt2, 'NewSellOrder')
                        assertEvent(receipt3, 'NewBuyOrder')
                        assertEvent(receipt4, 'NewSellOrder')
                        // assert that the orders are all in the same batch
                        const batchId1 = getSellOrderBatchId(receipt1)
                        const batchId2 = getSellOrderBatchId(receipt2)
                        const batchId3 = getBuyOrderBatchId(receipt3)
                        const batchId4 = getSellOrderBatchId(receipt4)
                        assert.equal(batchId1.toNumber(), batchId2.toNumber())
                        assert.equal(batchId1.toNumber(), batchId3.toNumber())
                        assert.equal(batchId1.toNumber(), batchId4.toNumber())
                        // assert that ETH batch is correct
                        const batchETH = await getBatch(batchId1, ETH)
                        const buyFeeETH = computeBuyFee(amountETH)
                        const saleETH = await saleReturn(0, balance1.plus(balance2), amountETH.minus(buyFeeETH), third.add(balance2))
                        assert.equal(batchETH.initialized, true)
                        assert.equal(batchETH.cancelled, false)
                        assert.equal(batchETH.supply.toNumber(), VIRTUAL_SUPPLIES[0] + balance1.plus(balance2).toNumber())
                        assert.equal(batchETH.balance.toNumber(), VIRTUAL_BALANCES[0] + amountETH.minus(buyFeeETH).toNumber())
                        assert.equal(batchETH.totalBuySpend.toNumber(), 0)
                        assert.equal(batchETH.totalBuyReturn.toNumber(), 0)
                        assert.equal(batchETH.totalSellSpend.toNumber(), third.add(balance2).toNumber())
                        assert.equal(batchETH.totalSellReturn.toNumber(), saleETH.toNumber())
                        // assert that token1 batch is correct
                        const batch1 = await getBatch(batchId1, collateral.address)
                        const buyFeeToken11 = computeBuyFee(amountToken11)
                        const buyFeeToken12 = computeBuyFee(amountToken12)
                        const buyFeeToken21 = computeBuyFee(amountToken21)
                        const _balance = amountToken11
                          .minus(buyFeeToken11)
                          .add(amountToken12)
                          .minus(buyFeeToken12)
                        assert.equal(batch1.initialized, true)
                        assert.equal(batch1.cancelled, false)
                        assert.equal(batch1.supply.toNumber(), VIRTUAL_SUPPLIES[1] + balance1.plus(balance2).toNumber())
                        assert.equal(batch1.balance.toNumber(), VIRTUAL_BALANCES[1] + _balance.toNumber())
                        assert.equal(batch1.totalBuySpend.toNumber(), amountToken21.minus(buyFeeToken21).toNumber())
                        // assert.equal(batch1.totalBuyReturn.toNumber(), XXX) // there are both buys and sells so it should be tested in maths
                        assert.equal(batch1.totalSellSpend.toNumber(), third.toNumber())
                        // assert.equal(batch1.totalSellReturn.toNumber(), XXX) // there are both buys and sells so it should be tested in maths
                        // assert that tokensToBeMinted and collateralsToBeClaimed are correct
                        const tokensToBeMinted = await curve.tokensToBeMinted()
                        const ETHToBeClaimed = await curve.collateralsToBeClaimed(ETH)
                        const token1ToBeClaimed = await curve.collateralsToBeClaimed(collateral.address)
                        assert.equal(tokensToBeMinted.toNumber(), batch1.totalBuyReturn.toNumber())
                        assert.equal(ETHToBeClaimed.toNumber(), batchETH.totalSellReturn.toNumber())
                        assert.equal(token1ToBeClaimed.toNumber(), batch1.totalSellReturn.toNumber())
                      })
                    })
                  })

                  context('> but pool does not have sufficient funds', () => {
                    it('it should revert', async () => {
                      const _index = index === 1 ? 0 : 1
                      // let's add some collateral into the pool
                      await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                      // then let's buy some bonds against another collateral
                      const _balance = await openAndClaimBuyOrder(authorized, collaterals[_index], randomAmount(), { from: authorized })
                      // then let's redeem more bonds against the base collateral than it can pay for and assert it reverts
                      await assertRevert(() => openSellOrder(authorized, collaterals[index], _balance, { from: authorized }))
                    })
                  })
                })

                context('> but order breaks maximum batch slippage', () => {
                  it('it should revert', async () => {
                    // let's buy lots of bonds
                    const amount = new web3.BigNumber(5).mul(new web3.BigNumber(Math.pow(10, 18)))
                    const fee = computeBuyFee(amount)
                    const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                    // let's set maximum slippage to 50%
                    await curve.updateCollateralToken(
                      collaterals[index],
                      VIRTUAL_SUPPLIES[index],
                      VIRTUAL_BALANCES[index],
                      RESERVE_RATIOS[index],
                      5 * Math.pow(10, 17),
                      { from: authorized }
                    )

                    const sale1 = new web3.BigNumber(2).mul(new web3.BigNumber(Math.pow(10, 18)))
                    const sale2 = new web3.BigNumber(1.5).mul(new web3.BigNumber(Math.pow(10, 18)))
                    // here we should have a slippage of about 52% so it should revert
                    await assertRevert(() => openSellOrder(authorized, collaterals[index], sale1, { from: authorized }))
                    // here we sould have a slippage of about 30% so it should not revert
                    await openSellOrder(authorized, collaterals[index], sale2, { from: authorized })
                  })
                })
              })

              context('> but sender does not have sufficient funds', () => {
                it('it should revert', async () => {
                  const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                  await assertRevert(() => openSellOrder(authorized, collaterals[index], _balance.add(1), { from: authorized }))
                })
              })
            })

            context('> but amount is zero', () => {
              it('it should revert', async () => {
                await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                await assertRevert(() => openSellOrder(authorized, collaterals[index], 0, { from: authorized }))
              })
            })
          })

          context('> but batch is cancelled', () => {
            it('it should revert', async () => {
              const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
              await curve.removeCollateralToken(collaterals[index], { from: authorized })
              // batch is now cancelled
              await assertRevert(() => openSellOrder(authorized, collaterals[index], _balance, { from: authorized }))
            })
          })
        })

        context('> but collateral is not whitelisted', () => {
          it('it should revert', async () => {
            // we can't test un-whitelisted ETH unless we re-deploy a DAO without ETH as a whitelisted
            // collateral just for that use case it's not worth it because the logic is the same than ERC20 anyhow
            const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
            await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
            const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            await assertRevert(() => openSellOrder(authorized, unlisted.address, _balance, { from: authorized }))
          })
        })
      })

      context('> sender does not have OPEN_SELL_ORDER_ROLE', () => {
        it('it should revert', async () => {
          const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
          await assertRevert(() => openSellOrder(authorized, collaterals[index], _balance, { from: unauthorized }))
        })
      })
    })
  })
  // #endregion

  // #region claimBuyOrder
  context('> #claimBuyOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> collateral is whitelisted', () => {
        context('> and batch is over', () => {
          context('> and there are bonds to claim', () => {
            it('it should register claim', async () => {
              const receipt1 = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
              const batchId = getBuyOrderBatchId(receipt1)

              await progressToNextBatch()
              const receipt2 = await curve.claimBuyOrder(authorized, batchId, collaterals[index])

              assertEvent(receipt2, 'ReturnBuyOrder')
            })

            it('it should return bonds', async () => {
              const amount = randomAmount()
              const fee = computeBuyFee(amount)

              const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
              const batchId = getBuyOrderBatchId(receipt)
              const purchase = await formula.calculatePurchaseReturn(VIRTUAL_SUPPLIES[index], VIRTUAL_BALANCES[index], RESERVE_RATIOS[index], amount.minus(fee))

              await progressToNextBatch()

              await curve.claimBuyOrder(authorized, batchId, collaterals[index])
              const _balance = await getBalance(token.address, authorized)

              assert.equal(_balance.toNumber(), purchase.toNumber())
            })

            it('it should update the amount of token to be minted', async () => {
              const amount = randomAmount()
              const fee = computeBuyFee(amount)

              const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
              const batchId = getBuyOrderBatchId(receipt)
              const purchase = await formula.calculatePurchaseReturn(VIRTUAL_SUPPLIES[index], VIRTUAL_BALANCES[index], RESERVE_RATIOS[index], amount.minus(fee))
              const tokensToBeMinted1 = await curve.tokensToBeMinted()

              assert.equal(tokensToBeMinted1.toNumber(), purchase.toNumber())

              await progressToNextBatch()

              await curve.claimBuyOrder(authorized, batchId, collaterals[index])
              const tokensToBeMinted2 = await curve.tokensToBeMinted()

              assert.equal(tokensToBeMinted2.toNumber(), 0)
            })
          })

          context('> but there are no bonds to claim', () => {
            context('> because address has no pending buy order at all', () => {
              it('it should revert', async () => {
                const receipt = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                const batchId = getBuyOrderBatchId(receipt)

                await progressToNextBatch()

                await assertRevert(() => curve.claimBuyOrder(authorized2, batchId, collaterals[index]))
              })
            })

            context('> because address has a pending buy order but created through another collateral', () => {
              it('it should revert', async () => {
                const receipt = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                const batchId = getBuyOrderBatchId(receipt)
                const _index = index === 1 ? 0 : 1

                await progressToNextBatch()

                await assertRevert(() => curve.claimBuyOrder(authorized, batchId, collaterals[_index]))
              })
            })

            context('> because buy order has already been claimed', () => {
              it('it should revert', async () => {
                const receipt = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                const batchId = getBuyOrderBatchId(receipt)

                await progressToNextBatch()
                await curve.claimBuyOrder(authorized, batchId, collaterals[index])

                await assertRevert(() => curve.claimBuyOrder(authorized, batchId, collaterals[index]))
              })
            })
          })
        })

        context('> but batch is not yet over', () => {
          it('it should revert', async () => {
            const receipt = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt)

            await assertRevert(() => curve.claimBuyOrder(authorized, batchId, collaterals[index]))
          })
        })
      })

      context('> but collateral is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })

          const receipt = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
          const batchId = getBuyOrderBatchId(receipt)

          await progressToNextBatch()

          await assertRevert(() => curve.claimBuyOrder(authorized, batchId, unlisted.address))
        })
      })
    })
  })
  // #endregion

  // #region claimSellOrder
  context('> #claimSellOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> collateral is whitelisted', () => {
        context('> and batch is over', () => {
          context('> and there are collateral to claim', () => {
            it('it should register claim', async () => {
              const receipt1 = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
              const batchId = getSellOrderBatchId(receipt1)

              await progressToNextBatch()

              const receipt2 = await curve.claimSellOrder(authorized, batchId, collaterals[index])

              assertEvent(receipt2, 'ReturnSellOrder')
            })

            it('it should return collateral', async () => {
              // let's define purchase amount and fee
              const amount = randomAmount()
              const fee = computeBuyFee(amount)
              // let's buy, claim and sell some bonds
              const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
              const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
              const batchId = getSellOrderBatchId(receipt1)
              // let's save the actual collateral balance of the seller
              const balance1 = await getBalance(collaterals[index], authorized)
              // let's compute how much colleral should be transfered
              const sale = await saleReturn(index, _balance, amount.minus(fee), _balance)
              const saleFee = computeSellFee(sale)
              // let's move to next batch
              await progressToNextBatch()
              // let's claim the collateral
              await curve.claimSellOrder(authorized, batchId, collaterals[index])
              // let's save the new collateral balance of the seller
              const balance2 = await getBalance(collaterals[index], authorized)

              assert.equal(balance2.toNumber(), balance1.add(sale.minus(saleFee)).toNumber())
            })

            it('it should deduct fee', async () => {
              // let's define purchase amount and fee
              const amount = randomAmount()
              const fee = computeBuyFee(amount)
              // let's buy, claim and sell some bonds
              const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
              const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
              const batchId = getSellOrderBatchId(receipt1)
              // let's save the actual collateral balance of the beneficiary
              const balance1 = await getBalance(collaterals[index], beneficiary)
              // let's compute how much colleral should be transfered
              const sale = await saleReturn(index, _balance, amount.minus(fee), _balance)
              const saleFee = computeSellFee(sale)
              // let's move to next batch
              await progressToNextBatch()
              // let's claim the collateral
              await curve.claimSellOrder(authorized, batchId, collaterals[index])
              // let's save the new collateral balance of the beneficiary
              const balance2 = await getBalance(collaterals[index], beneficiary)

              assert.equal(balance2.toNumber(), balance1.add(saleFee).toNumber())
            })

            it('it should update the amount of collateral to be claimed', async () => {
              const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
              const batchId = getSellOrderBatchId(receipt)
              const toBeClaimed1 = await curve.collateralsToBeClaimed(collaterals[index])

              assert.isAbove(toBeClaimed1.toNumber(), 0)

              await progressToNextBatch()
              await curve.claimSellOrder(authorized, batchId, collaterals[index])
              const toBeClaimed2 = await curve.collateralsToBeClaimed(collaterals[index])

              assert.equal(toBeClaimed2.toNumber(), 0)
            })
          })

          context('> but there are no collateral to claim', () => {
            context('> because address has no pending sell order at all', () => {
              it('it should revert', async () => {
                const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                const batchId = getSellOrderBatchId(receipt)

                await progressToNextBatch()

                await assertRevert(() => curve.claimSellOrder(authorized2, batchId, collaterals[index]))
              })
            })

            context('> because address has a pending sell order but created through another collateral', () => {
              it('it should revert', async () => {
                const _index = index === 1 ? 0 : 1

                const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                const batchId = getSellOrderBatchId(receipt)

                await progressToNextBatch()

                await assertRevert(() => curve.claimSellOrder(authorized, batchId, collaterals[_index]))
              })
            })

            context('> because sell order has already been claimed', () => {
              it('it should revert', async () => {
                const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
                const batchId = getSellOrderBatchId(receipt)

                await progressToNextBatch()
                await curve.claimSellOrder(authorized, batchId, collaterals[index])

                await assertRevert(() => curve.claimSellOrder(authorized, batchId, collaterals[index]))
              })
            })
          })
        })

        context('> but batch is not yet over', () => {
          it('it should revert', async () => {
            const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const batchId = getSellOrderBatchId(receipt)

            await assertRevert(() => curve.claimSellOrder(authorized, batchId, collaterals[index]))
          })
        })
      })

      context('> but collateral is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })

          const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
          const batchId = getSellOrderBatchId(receipt)

          await progressToNextBatch()

          await assertRevert(() => curve.claimSellOrder(authorized, batchId, unlisted.address))
        })
      })
    })
  })
  // #endregion

  // #region claimCancelledBuyOrder
  context('> #claimCancelledBuyOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> batch is cancelled', () => {
        context('> and there are collaterals to claim', () => {
          it('it should register claim', async () => {
            const amount = randomAmount()

            const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)

            await curve.removeCollateralToken(collaterals[index], { from: authorized })
            const receipt2 = await curve.claimCancelledBuyOrder(authorized, batchId, collaterals[index])

            assertEvent(receipt2, 'ReturnCancelledBuyOrder')
          })

          it('it should return collateral', async () => {
            const amount = randomAmount()
            const fee = computeBuyFee(amount)

            const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)
            const oldBalance = await getBalance(collaterals[index], authorized)

            await curve.removeCollateralToken(collaterals[index], { from: authorized })
            await curve.claimCancelledBuyOrder(authorized, batchId, collaterals[index])
            const newBalance = await getBalance(collaterals[index], authorized)

            assert.isAbove(newBalance.toNumber(), oldBalance.toNumber())
          })

          it('it should update the amount of collateral to be claimed', async () => {
            const receipt1 = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)

            await curve.removeCollateralToken(collaterals[index], { from: authorized })
            await curve.claimCancelledBuyOrder(authorized, batchId, collaterals[index])
            const collateralsToBeClaimed = await curve.collateralsToBeClaimed(collaterals[index])

            assert.equal(collateralsToBeClaimed.toNumber(), 0)
          })
        })

        context('> but there are no collateral to claim', () => {
          it('it should revert', async () => {
            const receipt1 = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)
            await curve.removeCollateralToken(collaterals[index], { from: authorized })

            await assertRevert(() => curve.claimCancelledBuyOrder(authorized2, batchId, collaterals[index]))
          })
        })
      })

      context('> but batch is not cancelled', () => {
        it('it should revert', async () => {
          const receipt1 = await openBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
          const batchId = getBuyOrderBatchId(receipt1)

          await assertRevert(() => curve.claimCancelledBuyOrder(authorized, batchId, collaterals[index]))
        })
      })
    })
  })
  // #endregion

  // #region claimCancelledSellOrder
  context('> #claimCancelledSellOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> batch is cancelled', () => {
        context('> and there are bonds to claim', () => {
          it('it should register claim', async () => {
            const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
            const batchId = getSellOrderBatchId(receipt1)

            await curve.removeCollateralToken(collaterals[index], { from: authorized })
            const receipt2 = await curve.claimCancelledSellOrder(authorized, batchId, collaterals[index])

            assertEvent(receipt2, 'ReturnCancelledSellOrder')
          })

          it('it should return bonds', async () => {
            const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
            const oldBalance = await getBalance(token.address, authorized)
            const batchId = getSellOrderBatchId(receipt1)

            await curve.removeCollateralToken(collaterals[index], { from: authorized })
            await curve.claimCancelledSellOrder(authorized, batchId, collaterals[index])
            const newBalance = await getBalance(token.address, authorized)

            assert.equal(newBalance.toNumber(), oldBalance.add(_balance).toNumber())
          })

          it('it should update the amount of tokens to be minted', async () => {
            const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
            const batchId = getSellOrderBatchId(receipt1)

            await curve.removeCollateralToken(collaterals[index], { from: authorized })
            await curve.claimCancelledSellOrder(authorized, batchId, collaterals[index])
            const tokensToBeMinted = await curve.tokensToBeMinted()

            assert.equal(tokensToBeMinted.toNumber(), 0)
          })
        })

        context('> but there are no bond to claim', () => {
          it('it should revert', async () => {
            const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
            const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
            const batchId = getSellOrderBatchId(receipt1)
            await curve.removeCollateralToken(collaterals[index], { from: authorized })

            await assertRevert(() => curve.claimCancelledSellOrder(authorized2, batchId, collaterals[index]))
          })
        })
      })

      context('> but batch is not cancelled', () => {
        it('it should revert', async () => {
          const _balance = await openAndClaimBuyOrder(authorized, collaterals[index], randomAmount(), { from: authorized })
          const receipt1 = await openSellOrder(authorized, collaterals[index], _balance, { from: authorized })
          const batchId = getSellOrderBatchId(receipt1)

          await assertRevert(() => curve.claimCancelledSellOrder(authorized, batchId, collaterals[index]))
        })
      })
    })
  })
  // #endregion

  // #region maths
  context('> #maths', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1
      const user1 = authorized
      const user2 = authorized2

      context('> there are only buy orders', () => {
        it('it should return the right amount of bonded tokens', async () => {
          const amount1 = randomAmount()
          const amount2 = randomAmount()
          const fee1 = computeBuyFee(amount1)
          const fee2 = computeBuyFee(amount2)
          const amountAfterFee1 = amount1.minus(fee1)
          const amountAfterFee2 = amount2.minus(fee2)
          const amountAfterFee = amountAfterFee1.plus(amountAfterFee2)
          const purchase = await purchaseReturn(index, 0, 0, amountAfterFee)
          const receipt = await openBuyOrder(user1, collaterals[index], amount1, { from: authorized })
          await openBuyOrder(user2, collaterals[index], amount2, { from: authorized })
          const batchId = getBuyOrderBatchId(receipt)
          const batch = await getBatch(batchId, collaterals[index])
          await progressToNextBatch()
          await curve.claimBuyOrder(user1, batchId, collaterals[index])
          await curve.claimBuyOrder(user2, batchId, collaterals[index])
          const balance1 = await getBalance(token.address, user1)
          const balance2 = await getBalance(token.address, user2)
          const return1 = batch.totalBuyReturn.mul(amountAfterFee1).div(amountAfterFee)
          const return2 = batch.totalBuyReturn.mul(amountAfterFee2).div(amountAfterFee)
          assert.equal(batch.totalBuySpend.toNumber(), amountAfterFee.toNumber())
          assert.equal(batch.totalBuyReturn.toNumber(), purchase.toNumber())
          assert.equal(balance1.toNumber(), return1.toNumber())
          assert.equal(balance2.toNumber(), return2.toNumber())
        })
      })

      context('> there are only sell orders', () => {
        it('it should return the right amount of collaterals', async () => {
          // let's buy some bonds to redeem them afterwards
          const buyAmount1 = randomAmount()
          const buyAmount2 = randomAmount()
          const buyFee1 = computeBuyFee(buyAmount1)
          const buyFee2 = computeBuyFee(buyAmount2)
          const buyAmountAfterFee1 = buyAmount1.minus(buyFee1)
          const buyAmountAfterFee2 = buyAmount2.minus(buyFee2)
          const buyAmountAfterFee = buyAmountAfterFee1.plus(buyAmountAfterFee2)
          // we now have minted bonds we can redeem
          const sellAmount1 = await openAndClaimBuyOrder(user1, collaterals[index], buyAmount1, { from: authorized })
          const sellAmount2 = await openAndClaimBuyOrder(user2, collaterals[index], buyAmount2, { from: authorized })
          const supply = sellAmount1.plus(sellAmount2)
          const sellAmount = supply
          // let's redeem these bonds
          const receipt = await openSellOrder(user1, collaterals[index], sellAmount1, { from: authorized })
          await openSellOrder(user2, collaterals[index], sellAmount2, { from: authorized })
          await progressToNextBatch()
          // let's compute how orders should be matched
          const sale = await saleReturn(index, supply, buyAmountAfterFee, sellAmount)
          // let's check that orders have been matched properly
          const batchId = getSellOrderBatchId(receipt)
          const batch = await getBatch(batchId, collaterals[index])
          assert.equal(batch.totalSellSpend.toNumber(), sellAmount.toNumber())
          assert.equal(batch.totalSellReturn.toNumber(), sale.toNumber())
          // let's compute how many collaterals should be returned
          const _balance1 = await getBalance(collaterals[index], user1)
          const _balance2 = await getBalance(collaterals[index], user2)
          await curve.claimSellOrder(user1, batchId, collaterals[index])
          await curve.claimSellOrder(user2, batchId, collaterals[index])
          const balance1_ = await getBalance(collaterals[index], user1)
          const balance2_ = await getBalance(collaterals[index], user2)
          const return1 = balance1_.minus(_balance1)
          const return2 = balance2_.minus(_balance2)
          const expectedReturn1_ = batch.totalSellReturn.mul(sellAmount1).div(sellAmount)
          const expectedReturn2_ = batch.totalSellReturn.mul(sellAmount2).div(sellAmount)
          const expectedReturn1 = expectedReturn1_.minus(computeSellFee(expectedReturn1_))
          const expectedReturn2 = expectedReturn2_.minus(computeSellFee(expectedReturn2_))
          // let's check that returned collaterals match expected returns
          assert.equal(return1.toNumber(), expectedReturn1.toNumber())
          assert.equal(return2.toNumber(), expectedReturn2.toNumber())
        })
      })

      context('> there are both buy and sell orders', () => {
        context('> buy orders are worth more than sell orders', () => {
          it('it should return the right amount of bonds and collaterals', async () => {
            // let's buy some bonds to redeem them afterwards
            const preAmount = BN(Math.pow(10, 20))
            const preAmountFee = computeBuyFee(preAmount)
            const preAmountAfterFee = preAmount.minus(preAmountFee)
            // we now have some minted bonds
            const minted = await openAndClaimBuyOrder(user1, collaterals[index], preAmount, { from: authorized })
            // let's compute what is the static price once these bonds have been minted
            const overallSupply = minted.add(VIRTUAL_SUPPLIES[index])
            const overallBalance = preAmountAfterFee.add(VIRTUAL_BALANCES[index])
            const staticPricePPM = await curve.getStaticPricePPM(overallSupply, overallBalance, RESERVE_RATIOS[index])
            // let's open some buy and sell orders
            const buyAmount = BN(Math.pow(10, 19))
            const buyAmountFee = computeBuyFee(buyAmount)
            const buyAmountAfterFee = buyAmount.minus(buyAmountFee)
            const sellAmount = BN(Math.pow(10, 18))
            const receipt = await openBuyOrder(user2, collaterals[index], buyAmount, { from: authorized })
            await openSellOrder(user1, collaterals[index], sellAmount, { from: authorized })
            // let's fetch the batch
            const batchId = getBuyOrderBatchId(receipt)
            const batch = await getBatch(batchId, collaterals[index])
            // buy orders are worth more than sell orders so ...
            // sell orders should be matched against the buy orders at the current static price
            const expectedSaleReturn = staticPricePPM.mul(sellAmount).div(PPM)
            // no need to check claims as their logic is the same than where there are only sell orders [already checked above]
            assert.equal(batch.totalSellSpend.toNumber(), sellAmount.toNumber())
            assert.equal(batch.totalSellReturn.toNumber(), expectedSaleReturn.toNumber())
            // now that sell orders have been matched the remaining buy orders should be added and matched normally along the formula
            const remainingBuy = buyAmountAfterFee.minus(expectedSaleReturn)
            const expectedRemainingBuyReturn = await purchaseReturn(index, minted, preAmountAfterFee, remainingBuy)
            const expectedBuyReturn = expectedRemainingBuyReturn.add(sellAmount)
            // no need to check claims as their logic is the same than where there are only buy orders [already checked above]
            assert.equal(batch.totalBuySpend.toNumber(), buyAmountAfterFee.toNumber())
            assert.equal(batch.totalBuyReturn.toNumber(), expectedBuyReturn.toNumber())
          })
        })

        context('> sell orders are worth more than buy orders', () => {
          it('it should return the right amount of bonds and collaterals', async () => {
            // let's buy some bonds to redeem them afterwards
            const preAmount = BN(Math.pow(10, 20))
            const preAmountFee = computeBuyFee(preAmount)
            const preAmountAfterFee = preAmount.minus(preAmountFee)
            // we now have some minted bonds
            const minted = await openAndClaimBuyOrder(user1, collaterals[index], preAmount, { from: authorized })
            // let's compute what is the static price once these bonds have been minted
            const overallSupply = minted.add(VIRTUAL_SUPPLIES[index])
            const overallBalance = preAmountAfterFee.add(VIRTUAL_BALANCES[index])
            const staticPricePPM = await curve.getStaticPricePPM(overallSupply, overallBalance, RESERVE_RATIOS[index])
            // let's open some buy and sell orders
            const buyAmount = BN(Math.pow(10, 18))
            const buyAmountFee = computeBuyFee(buyAmount)
            const buyAmountAfterFee = buyAmount.minus(buyAmountFee)
            const sellAmount = BN(Math.pow(10, 19))
            const receipt = await openBuyOrder(user2, collaterals[index], buyAmount, { from: authorized })
            await openSellOrder(user1, collaterals[index], sellAmount, { from: authorized })
            // let's fetch the batch
            const batchId = getBuyOrderBatchId(receipt)
            const batch = await getBatch(batchId, collaterals[index])
            // sell orders are worth more than buy orders so ...
            // buy orders should be matched against the sell orders at the current static price
            const expectedBuyReturn = buyAmountAfterFee.mul(PPM).div(staticPricePPM)
            // no need to check claims as their logic is the same than where there are only buy orders [already checked above]
            assert.equal(batch.totalBuySpend.toNumber(), buyAmountAfterFee.toNumber())
            assert.equal(batch.totalBuyReturn.toNumber(), expectedBuyReturn.toNumber())
            // now that buy orders have been matched the remaining sell orders should be added and matched normally along the formula
            const remainingSell = sellAmount.minus(expectedBuyReturn)
            const expectedRemainingSellReturn = await saleReturn(index, minted, preAmountAfterFee, remainingSell)
            const expectedSellReturn = expectedRemainingSellReturn.add(buyAmountAfterFee)
            // no need to check claims as their logic is the same than where there are only sell orders [already checked above]
            assert.equal(batch.totalSellSpend.toNumber(), sellAmount.toNumber())
            assert.equal(batch.totalSellReturn.toNumber(), expectedSellReturn.toNumber())
          })
        })
      })
    })
  })
  // #endregion
})
