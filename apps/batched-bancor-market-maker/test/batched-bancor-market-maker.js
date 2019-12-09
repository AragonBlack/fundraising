const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const Controller = artifacts.require('AragonFundraisingControllerMock')
const TokenManager = artifacts.require('TokenManager')
const Agent = artifacts.require('Agent')
const Formula = artifacts.require('BancorFormula.sol')
const BancorMarketMaker = artifacts.require('BatchedBancorMarketMaker')
const TokenMock = artifacts.require('TokenMock')

const assertEvent = require('@aragon/test-helpers/assertEvent')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getBalance = require('@ablack/fundraising-shared-test-helpers/getBalance')(web3, TokenMock)
const { ZERO_ADDRESS } = require('@ablack/fundraising-shared-test-helpers/constants')
const { getEvent, getNewMetaBatchEvent, getNewBatchEvent, getBuyOrderBatchId, getSellOrderBatchId } = require('@ablack/fundraising-shared-test-helpers/events')
const random = require('@ablack/fundraising-shared-test-helpers/random')

const { hash } = require('eth-ens-namehash')
const forEach = require('mocha-each')

const RESERVE_ID = hash('agent.aragonpm.eth')
const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
const CONTROLLER_ID = hash('aragon-fundraising.aragonpm.eth')
const MARKET_MAKER_ID = hash('batched-bancor-market-maker.aragonpm.eth')

const INITIAL_TOKEN_BALANCE = 10000 * Math.pow(10, 18) // 10000 DAIs or ANTs
const PPM = 1000000
const PCT_BASE = 1000000000000000000

const BUY_FEE_PERCENT = 100000000000000000 // 1%
const SELL_FEE_PERCENT = 100000000000000000
const MAXIMUM_SLIPPAGE = 10 * PCT_BASE // x10
const BLOCKS_IN_BATCH = 10

const VIRTUAL_SUPPLIES = [new web3.BigNumber(Math.pow(10, 23)), new web3.BigNumber(Math.pow(10, 22))]
const VIRTUAL_BALANCES = [new web3.BigNumber(Math.pow(10, 22)), new web3.BigNumber(Math.pow(10, 20))]
const RESERVE_RATIOS = [(PPM * 10) / 100, (PPM * 1) / 100]

const progressToNextBatch = require('@ablack/fundraising-shared-test-helpers/progressToNextBatch')(web3, BLOCKS_IN_BATCH)

const { ETH } = require('@ablack/fundraising-shared-test-helpers/constants')

contract('BatchedBancorMarketMaker app', accounts => {
  let factory, dao, acl, cBase, tBase, rBase, mBase, token, tokenManager, controller, reserve, formula, marketMaker, collateral, collaterals
  let APP_MANAGER_ROLE,
    MINT_ROLE,
    BURN_ROLE,
    OPEN_ROLE,
    ADD_COLLATERAL_TOKEN_ROLE,
    REMOVE_COLLATERAL_TOKEN_ROLE,
    UPDATE_COLLATERAL_TOKEN_ROLE,
    UPDATE_BENEFICIARY_ROLE,
    UPDATE_FORMULA_ROLE,
    UPDATE_FEES_ROLE,
    OPEN_BUY_ORDER_ROLE,
    OPEN_SELL_ORDER_ROLE,
    TRANSFER_ROLE

  const root = accounts[0]
  const authorized = accounts[1]
  const authorized2 = accounts[2]
  const unauthorized = accounts[3]
  const beneficiary = accounts[4]

  const initialize = async open => {
    // DAO
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = await ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
    // token
    token = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Bond', 18, 'BON', false)
    // market maker controller
    const cReceipt = await dao.newAppInstance(CONTROLLER_ID, cBase.address, '0x', false)
    controller = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))
    // token manager
    const tReceipt = await dao.newAppInstance(TOKEN_MANAGER_ID, tBase.address, '0x', false)
    tokenManager = await TokenManager.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))
    // pool
    const pReceipt = await dao.newAppInstance(RESERVE_ID, rBase.address, '0x', false)
    reserve = await Agent.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
    // bancor-curve
    const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
    marketMaker = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(marketMaker.address, tokenManager.address, MINT_ROLE, root, { from: root })
    await acl.createPermission(marketMaker.address, tokenManager.address, BURN_ROLE, root, { from: root })
    await acl.createPermission(marketMaker.address, reserve.address, TRANSFER_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, OPEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, REMOVE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, UPDATE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, UPDATE_FORMULA_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, UPDATE_FEES_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, OPEN_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, marketMaker.address, OPEN_SELL_ORDER_ROLE, root, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, ADD_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, REMOVE_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, UPDATE_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, UPDATE_BENEFICIARY_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, UPDATE_FORMULA_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, UPDATE_FEES_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, OPEN_BUY_ORDER_ROLE, { from: root })
    await acl.grantPermission(authorized2, marketMaker.address, OPEN_SELL_ORDER_ROLE, { from: root })
    // collaterals
    collateral = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE * 2)
    await collateral.transfer(authorized2, INITIAL_TOKEN_BALANCE, { from: authorized })
    collaterals = [ETH, collateral.address]
    // allowances
    await collateral.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await collateral.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized2 })
    // initializations
    await token.changeController(tokenManager.address)
    await tokenManager.initialize(token.address, true, 0)
    await reserve.initialize()
    await controller.initialize()
    await marketMaker.initialize(
      controller.address,
      tokenManager.address,
      formula.address,
      reserve.address,
      beneficiary,
      BLOCKS_IN_BATCH,
      BUY_FEE_PERCENT,
      SELL_FEE_PERCENT
    )
    // end up initializing market maker
    await marketMaker.addCollateralToken(ETH, VIRTUAL_SUPPLIES[0], VIRTUAL_BALANCES[0], RESERVE_RATIOS[0], MAXIMUM_SLIPPAGE, { from: authorized })
    await marketMaker.addCollateralToken(collateral.address, VIRTUAL_SUPPLIES[1], VIRTUAL_BALANCES[1], RESERVE_RATIOS[1], MAXIMUM_SLIPPAGE, {
      from: authorized,
    })

    if (open) {
      await marketMaker.open({ from: authorized })
    }

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
    let [
      initialized,
      cancelled,
      supply,
      balance,
      reserveRatio,
      slippage,
      totalBuySpend,
      totalBuyReturn,
      totalSellSpend,
      totalSellReturn,
    ] = await marketMaker.getBatch(batchNumber, collateralToken)
    return {
      initialized,
      cancelled,
      supply,
      balance,
      reserveRatio,
      slippage,
      totalBuySpend,
      totalBuyReturn,
      totalSellSpend,
      totalSellReturn,
    }
  }

  const getCollateralToken = async collateral => {
    const [whitelisted, virtualSupply, virtualBalance, reserveRatio, slippage] = await marketMaker.getCollateralToken(collateral)

    return { whitelisted, virtualSupply, virtualBalance, reserveRatio, slippage }
  }

  const openBuyOrder = async (buyer, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : buyer
    const value = collateral === ETH ? (opts && opts.value ? opts.value : amount) : opts && opts.value ? opts.value : 0
    const receipt = await marketMaker.openBuyOrder(buyer, collateral, amount, { from, value })

    return receipt
  }

  const openSellOrder = async (seller, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : seller
    const receipt = await marketMaker.openSellOrder(seller, collateral, amount, { from })

    return receipt
  }

  const openAndClaimBuyOrder = async (buyer, collateral, amount, opts = {}) => {
    const from = opts && opts.from ? opts.from : buyer
    const value = collateral === ETH ? (opts && opts.value ? opts.value : amount) : 0

    const receipt = await marketMaker.openBuyOrder(buyer, collateral, amount, { from, value })
    const batchId = getBuyOrderBatchId(receipt)

    await progressToNextBatch()
    await marketMaker.claimBuyOrder(buyer, batchId, collateral, { from })

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
    rBase = await Agent.new()
    mBase = await BancorMarketMaker.new()
    // constants
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TRANSFER_ROLE = await rBase.TRANSFER_ROLE()
    MINT_ROLE = await tBase.MINT_ROLE()
    BURN_ROLE = await tBase.BURN_ROLE()
    OPEN_ROLE = await mBase.OPEN_ROLE()
    ADD_COLLATERAL_TOKEN_ROLE = await mBase.ADD_COLLATERAL_TOKEN_ROLE()
    REMOVE_COLLATERAL_TOKEN_ROLE = await mBase.REMOVE_COLLATERAL_TOKEN_ROLE()
    UPDATE_COLLATERAL_TOKEN_ROLE = await mBase.UPDATE_COLLATERAL_TOKEN_ROLE()
    UPDATE_BENEFICIARY_ROLE = await mBase.UPDATE_BENEFICIARY_ROLE()
    UPDATE_FORMULA_ROLE = await mBase.UPDATE_FORMULA_ROLE()
    UPDATE_FEES_ROLE = await mBase.UPDATE_FEES_ROLE()
    OPEN_BUY_ORDER_ROLE = await mBase.OPEN_BUY_ORDER_ROLE()
    OPEN_SELL_ORDER_ROLE = await mBase.OPEN_SELL_ORDER_ROLE()
  })

  beforeEach(async () => {
    await initialize(true)
  })

  // #region deploy
  context('> #deploy', () => {
    it('> it should deploy', async () => {
      await BancorMarketMaker.new()
    })
  })
  // #endregion

  // UPDATE INITIALIZE PARAMETERS ORDERS
  // #region initialize
  // context('> #initialize', () => {
  //   context('> initialization parameters are correct', () => {
  //     it('it should initialize batched bancor market maker', async () => {
  //       assert.equal(await marketMaker.controller(), controller.address)
  //       assert.equal(await marketMaker.tokenManager(), tokenManager.address)
  //       assert.equal(await marketMaker.token(), token.address)
  //       assert.equal(await marketMaker.reserve(), reserve.address)
  //       assert.equal(await marketMaker.beneficiary(), beneficiary)
  //       assert.equal(await marketMaker.formula(), formula.address)
  //       assert.equal(await marketMaker.batchBlocks(), BLOCKS_IN_BATCH)
  //       assert.equal(await marketMaker.buyFeePct(), BUY_FEE_PERCENT)
  //       assert.equal(await marketMaker.sellFeePct(), SELL_FEE_PERCENT)
  //     })
  //   })

  //   context('> initialization parameters are not correct', () => {
  //     it('it should revert [controller is not a contract]', async () => {
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           authorized,
  //           tokenManager.address,
  //           reserve.address,
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
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           authorized,
  //           reserve.address,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           { from: root }
  //         )
  //       )
  //     })

  //     it('it should revert [token manager setting is invalid]', async () => {
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       const token_ = await MiniMeToken.new(ZERO_ADDRESS, ZERO_ADDRESS, 0, 'Bond', 18, 'BON', false)
  //       const tReceipt_ = await dao.newAppInstance(TOKEN_MANAGER_ID, tBase.address, '0x', false)
  //       const tokenManager_ = await TokenManager.at(getEvent(tReceipt_, 'NewAppProxy', 'proxy'))

  //       await token_.changeController(tokenManager_.address)
  //       await tokenManager_.initialize(token_.address, true, 1)

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager_.address,
  //           reserve.address,
  //           beneficiary,
  //           formula.address,
  //           BLOCKS_IN_BATCH,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           { from: root }
  //         )
  //       )
  //     })

  //     it('it should revert [reserve is not a contract]', async () => {
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
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
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           reserve.address,
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

  //     it('it should revert [beneficiary is null address]', async () => {
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           reserve.address,
  //           ZERO_ADDRESS,
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

  //     it('it should revert [batchBlocks is zero]', async () => {
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           reserve.address,
  //           beneficiary,
  //           formula.address,
  //           0,
  //           BUY_FEE_PERCENT,
  //           SELL_FEE_PERCENT,
  //           {
  //             from: root,
  //           }
  //         )
  //       )
  //     })

  //     it('it should revert [buy fee is not a percentage]', async () => {
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           reserve.address,
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
  //       const bReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mBase.address, '0x', false)
  //       const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

  //       assertRevert(() =>
  //         uninitialized.initialize(
  //           controller.address,
  //           tokenManager.address,
  //           reserve.address,
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
  //       marketMaker.initialize(
  //         controller.address,
  //         tokenManager.address,
  //         reserve.address,
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

  // #region open
  context('> #open', () => {
    context('> sender has OPEN_ROLE', () => {
      context('> and market making is not yet open', () => {
        beforeEach(async () => {
          await initialize(false)
        })

        it('it should open market making', async () => {
          const receipt = await marketMaker.open({ from: authorized })

          assertEvent(receipt, 'Open')
          assert.equal(await marketMaker.isOpen(), true)
        })
      })

      context('> but market making is already open', () => {
        it('it should revert', async () => {
          // market making is already open through the default initialize() script
          await assertRevert(() => marketMaker.open({ from: authorized }))
        })
      })
    })

    context('> sender does not have OPEN_ROLE', () => {
      beforeEach(async () => {
        await initialize(false)
      })

      it('it should revert', async () => {
        await assertRevert(() => marketMaker.open({ from: unauthorized }))
      })
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

              const virtualSupply = random.virtualSupply()
              const virtualBalance = random.virtualBalance()
              const reserveRatio = random.reserveRatio()
              const slippage = random.slippage()

              const receipt = await marketMaker.addCollateralToken(unlisted.address, virtualSupply, virtualBalance, reserveRatio, slippage, {
                from: authorized,
              })
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
                marketMaker.addCollateralToken(unlisted.address, random.virtualSupply(), random.virtualBalance(), PPM + 1, random.slippage(), {
                  from: authorized,
                })
              )
            })
          })
        })

        context('> but collateral token is not ETH or ERC20 [i.e. contract]', () => {
          it('it should revert', async () => {
            await assertRevert(() =>
              marketMaker.addCollateralToken(authorized, random.virtualSupply(), random.virtualBalance(), random.reserveRatio(), random.slippage(), {
                from: authorized,
              })
            )
          })
        })
      })

      context('> but collateral token has already been added', () => {
        it('it should revert', async () => {
          await assertRevert(() =>
            marketMaker.addCollateralToken(ETH, random.virtualSupply(), random.virtualBalance(), random.reserveRatio(), random.slippage(), { from: authorized })
          )
        })
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

        await assertRevert(() =>
          marketMaker.addCollateralToken(unlisted.address, random.virtualSupply(), random.virtualBalance(), random.reserveRatio(), random.slippage(), {
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
          const receipt = await marketMaker.removeCollateralToken(collateral.address, { from: authorized })
          const collateral_ = await getCollateralToken(collateral.address)

          assertEvent(receipt, 'RemoveCollateralToken')
          assert.equal(collateral_.whitelisted, false)
          assert.equal(collateral_.virtualSupply.toNumber(), 0)
          assert.equal(collateral_.virtualBalance.toNumber(), 0)
          assert.equal(collateral_.reserveRatio.toNumber(), 0)
          assert.equal(collateral_.slippage.toNumber(), 0)
        })

        it('it should cancel current batch', async () => {
          const balance = await openAndClaimBuyOrder(authorized, collateral.address, random.amount(), { from: authorized })

          const amount = random.amount()
          const fee = computeBuyFee(amount)
          await openBuyOrder(authorized, collateral.address, amount, { from: authorized })
          await openSellOrder(authorized, collateral.address, balance, { from: authorized })

          await marketMaker.removeCollateralToken(collateral.address, { from: authorized })
          const batchId = await marketMaker.getCurrentBatchId()
          const batch = await getBatch(batchId, collateral.address)

          const tokensToBeMinted = await marketMaker.tokensToBeMinted()
          const collateralsToBeClaimed = await marketMaker.collateralsToBeClaimed(collateral.address)

          assert.equal(batch.cancelled, true)
          assert.equal(tokensToBeMinted.toNumber(), balance.toNumber())
          assert.equal(collateralsToBeClaimed.toNumber(), amount.minus(fee).toNumber())
        })
      })

      context('> but collateral token is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

          await assertRevert(() => marketMaker.removeCollateralToken(unlisted.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => marketMaker.removeCollateralToken(collateral.address, { from: unauthorized }))
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
            const virtualSupply = random.virtualSupply()
            const virtualBalance = random.virtualBalance()
            const reserveRatio = random.reserveRatio()
            const slippage = random.slippage()

            const receipt = await marketMaker.updateCollateralToken(collateral.address, virtualSupply, virtualBalance, reserveRatio, slippage, {
              from: authorized,
            })
            const collateral_ = await getCollateralToken(collateral.address)

            assertEvent(receipt, 'UpdateCollateralToken')
            assert.equal(collateral_.whitelisted, true)
            assert.equal(collateral_.virtualSupply.toNumber(), virtualSupply)
            assert.equal(collateral_.virtualBalance.toNumber(), virtualBalance)
            assert.equal(collateral_.reserveRatio.toNumber(), reserveRatio)
            assert.equal(collateral_.slippage.toNumber(), slippage)
          })
        })

        context('> but reserve ratio is not valid', () => {
          it('it should revert', async () => {
            await assertRevert(() =>
              marketMaker.updateCollateralToken(collateral.address, random.virtualSupply(), random.virtualBalance(), PPM + 1, random.slippage(), {
                from: authorized,
              })
            )
          })
        })
      })

      context('> but collateral token is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

          await assertRevert(() =>
            marketMaker.updateCollateralToken(unlisted.address, random.virtualSupply(), random.virtualBalance(), random.reserveRatio(), random.slippage(), {
              from: authorized,
            })
          )
        })
      })
    })

    context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          marketMaker.updateCollateralToken(collateral.address, random.virtualSupply(), random.virtualBalance(), random.reserveRatio(), random.slippage(), {
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
          const receipt = await marketMaker.updateBeneficiary(root, { from: authorized })

          assertEvent(receipt, 'UpdateBeneficiary')
          assert.equal(await marketMaker.beneficiary(), root)
        })
      })

      context('> but beneficiary is not valid', () => {
        it('it should revert', async () => {
          await assertRevert(() => marketMaker.updateBeneficiary(ZERO_ADDRESS, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_BENEFICIARY_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => marketMaker.updateBeneficiary(root, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateFormula
  context('> #updateFormula', () => {
    context('> sender has UPDATE_FORMULA_ROLE', () => {
      context('> and formula is a contract', () => {
        it('it should update formula', async () => {
          const formula_ = await Formula.new()
          const receipt = await marketMaker.updateFormula(formula_.address, { from: authorized })

          assertEvent(receipt, 'UpdateFormula')
          assert.equal(await marketMaker.formula(), formula_.address)
        })
      })

      context('> but formula is not a contract', () => {
        it('it should revert', async () => {
          await assertRevert(() => marketMaker.updateFormula(root, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_FORMULA_ROLE', () => {
      it('it should revert', async () => {
        const formula_ = await Formula.new()

        await assertRevert(() => marketMaker.updateFormula(formula_.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateFees
  context('> #updateFees', () => {
    context('> sender has UPDATE_FEES_ROLE', () => {
      context('> and new fees are valid', () => {
        it('it should update fees', async () => {
          const receipt = await marketMaker.updateFees(40, 50, { from: authorized })

          assertEvent(receipt, 'UpdateFees')
          assert.equal((await marketMaker.buyFeePct()).toNumber(), 40)
          assert.equal((await marketMaker.sellFeePct()).toNumber(), 50)
        })
      })

      context('> but new fees are not valid', () => {
        it('it should revert [buy fee is not valid]', async () => {
          await assertRevert(() => marketMaker.updateFees(PCT_BASE + 1, 50, { from: authorized }))
        })

        it('it should revert [sell fee is not valid]', async () => {
          await assertRevert(() => marketMaker.updateFees(40, PCT_BASE + 1, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_FEES_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => marketMaker.updateFees(40, 50, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openBuyOrder
  context('> #openBuyOrder', () => {
    forEach(['ETH', 'ERC20']).describe(`> %s`, round => {
      const index = round === 'ETH' ? 0 : 1

      context('> sender has OPEN_BUY_ORDER_ROLE', () => {
        context('> and market making is open', () => {
          context('> and collateral is whitelisted', () => {
            context('> and batch is not cancelled', () => {
              context('> and value is not zero', () => {
                context('> and sender has sufficient funds', () => {
                  context('> and no excess value is sent', () => {
                    context('> and order does not break maximum batch slippage', () => {
                      it('it should initialize new meta-batch [if needed]', async () => {
                        // let's initialize amounts for a first meta-batch
                        const amount = random.amount()
                        const fee = computeBuyFee(amount)
                        const amountAfterFee = amount.minus(fee)
                        const supply = await purchaseReturn(index, 0, 0, amountAfterFee)
                        // let's initialize a first meta-batch
                        const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const metaBatch1 = getNewMetaBatchEvent(receipt1)
                        // let's move to the next meta-batch
                        await progressToNextBatch()
                        // let's initialize a second meta-batch
                        const receipt2 = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                        assertEvent(receipt2, 'NewMetaBatch')
                        const metaBatch2 = getNewMetaBatchEvent(receipt2)
                        // let's check the new meta-batch is properly initialized
                        assert.isAbove(metaBatch2.id.toNumber(), metaBatch1.id.toNumber())
                        assert.equal(metaBatch2.supply.toNumber(), supply.toNumber())
                        assert.equal(metaBatch2.buyFeePct.toNumber(), BUY_FEE_PERCENT)
                        assert.equal(metaBatch2.sellFeePct.toNumber(), SELL_FEE_PERCENT)
                        assert.equal(metaBatch2.formula, formula.address)
                      })

                      it('it should initialize new batch [if needed]', async () => {
                        // let's initialize amounts for a first batch
                        const amount = random.amount()
                        const fee = computeBuyFee(amount)
                        const amountAfterFee = amount.minus(fee)
                        const supply = await purchaseReturn(index, 0, 0, amountAfterFee)
                        // let's initialize a first batch
                        const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const batch1 = getNewBatchEvent(receipt1)
                        // let's move to the next batch
                        await progressToNextBatch()
                        // let's initialize a second batch
                        const receipt2 = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                        assertEvent(receipt2, 'NewBatch')
                        const batchId = getBuyOrderBatchId(receipt2)
                        const batch2 = await getBatch(batchId, collaterals[index])
                        // let's check the new batch is properly initialized
                        assert.isAbove(batchId.toNumber(), batch1.id.toNumber())
                        assert.equal(batch2.initialized, true)
                        assert.equal(batch2.cancelled, false)
                        assert.equal(batch2.supply.toNumber(), VIRTUAL_SUPPLIES[index].add(supply).toNumber())
                        assert.equal(batch2.balance.toNumber(), VIRTUAL_BALANCES[index].add(amountAfterFee).toNumber())
                        assert.equal(batch2.reserveRatio.toNumber(), RESERVE_RATIOS[index])
                        assert.equal(batch2.slippage.toNumber(), MAXIMUM_SLIPPAGE)
                      })

                      it('it should register buy order', async () => {
                        const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })

                        assertEvent(receipt, 'OpenBuyOrder')
                      })

                      it('it should deduct fee', async () => {
                        const _balance = await getBalance(collaterals[index], beneficiary)

                        const amount = random.amount()
                        const fee = computeBuyFee(amount)

                        await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const balance_ = await getBalance(collaterals[index], beneficiary)

                        assert.equal(balance_.minus(_balance).toNumber(), fee.toNumber())
                      })

                      it('it should collect collateral', async () => {
                        const _balance = await getBalance(collaterals[index], reserve.address)

                        const amount = random.amount()
                        const fee = computeBuyFee(amount)
                        const amountAfterFee = amount.minus(fee)

                        await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const balance_ = await getBalance(collaterals[index], reserve.address)

                        assert.equal(balance_.minus(_balance).toNumber(), amountAfterFee.toNumber())
                      })

                      it('it should update batch', async () => {
                        const amount = random.amount()
                        const fee = computeBuyFee(amount)
                        const amountAfterFee = amount.minus(fee)
                        const purchase = await purchaseReturn(index, 0, 0, amountAfterFee)

                        const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const batchId = getBuyOrderBatchId(receipt)
                        const batch = await getBatch(batchId, collaterals[index])

                        assert.equal(batch.totalBuySpend.toNumber(), amountAfterFee.toNumber())
                        assert.equal(batch.totalBuyReturn.toNumber(), purchase.toNumber())
                        assert.equal(batch.totalSellSpend.toNumber(), 0)
                        assert.equal(batch.totalSellReturn.toNumber(), 0)
                      })

                      it('it should update the amount of tokens to be minted', async () => {
                        const amount = random.amount()
                        const fee = computeBuyFee(amount)
                        const amountAfterFee = amount.minus(fee)
                        const purchase = await purchaseReturn(index, 0, 0, amountAfterFee)

                        await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                        const tokensToBeMinted = await marketMaker.tokensToBeMinted()

                        assert.equal(tokensToBeMinted.toNumber(), purchase.toNumber())
                      })
                    })

                    context('> but order breaks maximum batch slippage', () => {
                      it('it should revert', async () => {
                        let amount1, amount2

                        // let's set a small price slippage of 15%
                        await marketMaker.updateCollateralToken(
                          collaterals[index],
                          VIRTUAL_SUPPLIES[index],
                          VIRTUAL_BALANCES[index],
                          RESERVE_RATIOS[index],
                          15 * Math.pow(10, 16),
                          { from: authorized }
                        )

                        if (index === 0) {
                          // buy price for batch after the first order shoud equal 1.14 for ETH
                          amount1 = BN(3777).mul(BN(Math.pow(10, 18)))
                          // buy price for batch after the second order shoud equal 1.16 for ETH
                          amount2 = BN(335).mul(BN(Math.pow(10, 18)))
                        } else {
                          // buy price for batch after the first order shoud equal 1.14 for ERC20
                          amount1 = BN(33).mul(BN(Math.pow(10, 18)))
                          // buy price for batch after the second order shoud equal 1.16 for ERC20
                          amount2 = BN(5.9).mul(BN(Math.pow(10, 18)))
                        }

                        // it should not revert
                        await openBuyOrder(authorized, collaterals[index], amount1, { from: authorized })
                        // it should revert
                        await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount2, { from: authorized }))
                      })
                    })
                  })

                  context('> but excess value is sent', () => {
                    it('it should revert', async () => {
                      const amount = random.amount()

                      await assertRevert(() => openBuyOrder(authorized, collaterals[index], amount, { from: authorized, value: amount.add(1) })) // should revert both for ETH and ERC20
                    })
                  })
                })

                context('> but sender does not have sufficient funds', () => {
                  it('it should revert', async () => {
                    const amount = random.amount()
                    // let's burn the extra tokens to end up with a small balance
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
                await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
                // current batch is now cancelled
                await assertRevert(() => openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized }))
              })
            })
          })

          context('> but collateral is not whitelisted', () => {
            it('it should revert', async () => {
              // we can't test un-whitelisted ETH unless we re-deploy a DAO without ETH as a whitelisted
              // collateral just for that use case it's not worth it because the logic is the same than ERC20 anyhow
              const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
              await unlisted.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })
              await assertRevert(() => openBuyOrder(authorized, unlisted.address, random.amount(), { from: authorized }))
            })
          })
        })

        context('> but market making is not open', () => {
          beforeEach(async () => {
            await initialize(false)
          })

          it('it should revert', async () => {
            await assertRevert(() => openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized }))
          })
        })
      })

      context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
        it('it should revert', async () => {
          await assertRevert(() => openBuyOrder(unauthorized, collaterals[index], random.amount(), { from: unauthorized }))
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
        context('> and market making is open', () => {
          context('> and collateral is whitelisted', () => {
            context('> and batch is not cancelled', () => {
              context('> and amount is not zero', () => {
                context('> and sender has sufficient funds', () => {
                  context('> and order does not break maximum batch slippage', () => {
                    context('> and pool has sufficient funds', () => {
                      context('> and there is one order', () => {
                        it('it should initialize new meta-batch [if needed]', async () => {
                          // this will initialize a first meta-batch
                          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                          const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
                          assertEvent(receipt, 'NewMetaBatch')
                          const metaBatch = getNewMetaBatchEvent(receipt)
                          assert.isAbove(metaBatch.id.toNumber(), 0)
                          assert.equal(metaBatch.supply.toNumber(), balance.toNumber())
                        })

                        it('it should initialize new batch [if needed]', async () => {
                          const amount = random.amount()
                          const fee = computeBuyFee(amount)
                          const amountAfterFee = amount.minus(fee)
                          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                          const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
                          assertEvent(receipt, 'NewBatch')
                          const batchId = getSellOrderBatchId(receipt)
                          const batch = await getBatch(batchId, collaterals[index])
                          assert.equal(batch.initialized, true)
                          assert.equal(batch.cancelled, false)
                          assert.isAbove(batchId.toNumber(), 0)
                          assert.equal(batch.supply.toNumber(), VIRTUAL_SUPPLIES[index].add(balance).toNumber())
                          assert.equal(batch.balance.toNumber(), VIRTUAL_BALANCES[index].add(amountAfterFee).toNumber())
                          assert.equal(batch.reserveRatio.toNumber(), RESERVE_RATIOS[index])
                        })

                        it('it should register sell order', async () => {
                          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                          const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
                          assertEvent(receipt, 'OpenSellOrder')
                        })

                        it('it should collect bonds', async () => {
                          const balance_ = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                          await openSellOrder(authorized, collaterals[index], balance_, { from: authorized })
                          const balance = await getBalance(token.address, authorized)
                          assert.equal(balance.toNumber(), 0)
                          assert.equal((await token.totalSupply()).toNumber(), 0)
                        })

                        it('it should update batch', async () => {
                          const amount = random.amount()
                          const fee = computeBuyFee(amount)
                          const amountAfterFee = amount.minus(fee)
                          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                          const saleReturn_ = await saleReturn(index, balance, amountAfterFee, balance)
                          const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
                          const batchId = getSellOrderBatchId(receipt)
                          const batch = await getBatch(batchId, collaterals[index])
                          assert.equal(batch.totalBuySpend.toNumber(), 0)
                          assert.equal(batch.totalBuyReturn.toNumber(), 0)
                          assert.equal(batch.totalSellSpend.toNumber(), balance.toNumber())
                          assert.equal(batch.totalSellReturn.toNumber(), saleReturn_.toNumber())
                        })

                        it('it should update the amount of collateral to be claimed', async () => {
                          const amount = random.amount()
                          const fee = computeBuyFee(amount)
                          const amountAfterFee = amount.minus(fee)
                          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                          const saleReturn_ = await saleReturn(index, balance, amountAfterFee, balance)
                          await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
                          const collateralToBeClaimed = await marketMaker.collateralsToBeClaimed(collaterals[index])
                          assert.equal(collateralToBeClaimed.toNumber(), saleReturn_.toNumber())
                        })
                      })

                      context('> and there are multiple orders', () => {
                        it('it should batch orders', async () => {
                          // set amounts
                          const amountETH = BN(5).mul(BN(Math.pow(10, 18)))
                          const amountToken11 = BN(2).mul(BN(Math.pow(10, 18)))
                          const amountToken12 = BN(1).mul(BN(Math.pow(10, 18)))
                          const amountToken21 = BN(5).mul(BN(Math.pow(10, 18)))
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
                          assertEvent(receipt1, 'OpenSellOrder')
                          assertEvent(receipt2, 'OpenSellOrder')
                          assertEvent(receipt3, 'OpenBuyOrder')
                          assertEvent(receipt4, 'OpenSellOrder')
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
                          assert.equal(batchETH.supply.toNumber(), VIRTUAL_SUPPLIES[0].add(balance1.plus(balance2)).toNumber())
                          assert.equal(batchETH.balance.toNumber(), VIRTUAL_BALANCES[0].add(amountETH.minus(buyFeeETH)).toNumber())
                          assert.equal(batchETH.totalBuySpend.toNumber(), 0)
                          assert.equal(batchETH.totalBuyReturn.toNumber(), 0)
                          assert.equal(batchETH.totalSellSpend.toNumber(), third.add(balance2).toNumber())
                          assert.equal(batchETH.totalSellReturn.toNumber(), saleETH.toNumber())
                          // assert that token1 batch is correct
                          const batch1 = await getBatch(batchId1, collateral.address)
                          const buyFeeToken11 = computeBuyFee(amountToken11)
                          const buyFeeToken12 = computeBuyFee(amountToken12)
                          const buyFeeToken21 = computeBuyFee(amountToken21)
                          const balance = amountToken11
                            .minus(buyFeeToken11)
                            .add(amountToken12)
                            .minus(buyFeeToken12)
                          assert.equal(batch1.initialized, true)
                          assert.equal(batch1.cancelled, false)
                          assert.equal(batch1.supply.toNumber(), VIRTUAL_SUPPLIES[1].add(balance1.plus(balance2)).toNumber())
                          assert.equal(batch1.balance.toNumber(), VIRTUAL_BALANCES[1].add(balance).toNumber())
                          assert.equal(batch1.totalBuySpend.toNumber(), amountToken21.minus(buyFeeToken21).toNumber())
                          // assert.equal(batch1.totalBuyReturn.toNumber(), XXX) // there are both buys and sells so it should be tested in maths
                          assert.equal(batch1.totalSellSpend.toNumber(), third.toNumber())
                          // assert.equal(batch1.totalSellReturn.toNumber(), XXX) // there are both buys and sells so it should be tested in maths
                          // assert that tokensToBeMinted and collateralsToBeClaimed are correct
                          const tokensToBeMinted = await marketMaker.tokensToBeMinted()
                          const ETHToBeClaimed = await marketMaker.collateralsToBeClaimed(ETH)
                          const token1ToBeClaimed = await marketMaker.collateralsToBeClaimed(collateral.address)
                          assert.equal(tokensToBeMinted.toNumber(), batch1.totalBuyReturn.toNumber())
                          assert.equal(ETHToBeClaimed.toNumber(), batchETH.totalSellReturn.toNumber())
                          assert.equal(token1ToBeClaimed.toNumber(), batch1.totalSellReturn.toNumber())
                        })
                      })
                    })

                    context('> but pool does not have sufficient funds', () => {
                      it('it should revert', async () => {
                        const index_ = index === 1 ? 0 : 1
                        // let's add some collateral into the pool
                        await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                        // then let's buy some bonds against another collateral
                        const balance = await openAndClaimBuyOrder(authorized, collaterals[index_], random.amount(), { from: authorized })
                        // then let's redeem more bonds against the base collateral than it can pay for and assert it reverts
                        await assertRevert(() => openSellOrder(authorized, collaterals[index], balance, { from: authorized }))
                      })
                    })
                  })

                  context('> but order breaks maximum batch slippage', () => {
                    it('it should revert', async () => {
                      let sale1, sale2

                      // let's set a high slipplage to buy as much bond as we want
                      await marketMaker.updateCollateralToken(
                        collaterals[index],
                        VIRTUAL_SUPPLIES[index],
                        VIRTUAL_BALANCES[index],
                        RESERVE_RATIOS[index],
                        10000 * Math.pow(10, 16),
                        { from: authorized }
                      )
                      const buyAmount = BN(5555).mul(BN(Math.pow(10, 18)))
                      await openAndClaimBuyOrder(authorized, collaterals[index], buyAmount, { from: authorized })

                      // let's set back maximum slippage to 15%
                      await marketMaker.updateCollateralToken(
                        collaterals[index],
                        VIRTUAL_SUPPLIES[index],
                        VIRTUAL_BALANCES[index],
                        RESERVE_RATIOS[index],
                        15 * Math.pow(10, 16),
                        { from: authorized }
                      )
                      if (index === 0) {
                        // sell slippage for batch after the first order shoud equal 14.21 for ETH
                        sale1 = BN(3600).mul(BN(Math.pow(10, 18)))
                        // sell slippage for batch after the second order shoud equal 15.30% for ETH
                        sale2 = BN(300).mul(BN(Math.pow(10, 18)))
                      } else {
                        // sell slippage for batch after the second order shoud equal 14.97 for ERC20
                        sale1 = BN(35).mul(BN(Math.pow(10, 18)))
                        // sell slippage for batch after the second order shoud equal 15.35% for ERC20
                        sale2 = BN(1).mul(BN(Math.pow(10, 18)))
                      }
                      // it should not revert
                      await openSellOrder(authorized, collaterals[index], sale1, { from: authorized })
                      // it should revert
                      await assertRevert(() => openSellOrder(authorized, collaterals[index], sale2, { from: authorized }))
                    })
                  })
                })

                context('> but sender does not have sufficient funds', () => {
                  it('it should revert', async () => {
                    const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                    await assertRevert(() => openSellOrder(authorized, collaterals[index], balance.add(1), { from: authorized }))
                  })
                })
              })

              context('> but amount is zero', () => {
                it('it should revert', async () => {
                  await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  await assertRevert(() => openSellOrder(authorized, collaterals[index], 0, { from: authorized }))
                })
              })
            })

            context('> but batch is cancelled', () => {
              it('it should revert', async () => {
                const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
                // batch is now cancelled
                await assertRevert(() => openSellOrder(authorized, collaterals[index], balance, { from: authorized }))
              })
            })
          })

          context('> but collateral is not whitelisted', () => {
            it('it should revert', async () => {
              // we can't test un-whitelisted ETH unless we re-deploy a DAO without ETH as a whitelisted
              // collateral just for that use case it's not worth it because the logic is the same than ERC20 anyhow
              const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
              await unlisted.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })
              const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })

              await assertRevert(() => openSellOrder(authorized, unlisted.address, balance, { from: authorized }))
            })
          })
        })

        context('> but market making is not open', () => {
          it('it should revert', async () => {
            // can't test cause we need the market making to be open to have bonds to redeem
          })
        })
      })

      context('> sender does not have OPEN_SELL_ORDER_ROLE', () => {
        it('it should revert', async () => {
          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
          await assertRevert(() => openSellOrder(authorized, collaterals[index], balance, { from: unauthorized }))
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
          context('> and batch is not cancelled', () => {
            context('> and there are bonds to claim', () => {
              it('it should register claim', async () => {
                const receipt1 = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                const batchId = getBuyOrderBatchId(receipt1)

                await progressToNextBatch()
                const receipt2 = await marketMaker.claimBuyOrder(authorized, batchId, collaterals[index])

                assertEvent(receipt2, 'ClaimBuyOrder')
              })

              it('it should return bonds', async () => {
                const amount1 = random.amount()
                const amount2 = random.amount()
                const fee1 = computeBuyFee(amount1)
                const fee2 = computeBuyFee(amount2)
                const amountAfterFee1 = amount1.minus(fee1)
                const amountAfterFee2 = amount2.minus(fee2)
                const amountAfterFee = amountAfterFee1.add(amountAfterFee2)
                const purchase = await purchaseReturn(index, 0, 0, amountAfterFee)

                const receipt = await openBuyOrder(authorized, collaterals[index], amount1, { from: authorized })
                await openBuyOrder(authorized2, collaterals[index], amount2, { from: authorized })
                const batchId = getBuyOrderBatchId(receipt)

                await progressToNextBatch()

                await marketMaker.claimBuyOrder(authorized, batchId, collaterals[index])
                await marketMaker.claimBuyOrder(authorized2, batchId, collaterals[index])

                const balance1 = await getBalance(token.address, authorized)
                const balance2 = await getBalance(token.address, authorized2)

                const expectedReturn1 = purchase.mul(amountAfterFee1).div(amountAfterFee)
                const expectedReturn2 = purchase.mul(amountAfterFee2).div(amountAfterFee)

                assert.equal(balance1.toNumber(), expectedReturn1.toNumber())
                assert.equal(balance2.toNumber(), expectedReturn2.toNumber())
              })

              it('it should update the amount of token to be minted', async () => {
                const amount = random.amount()
                const fee = computeBuyFee(amount)
                const amountAfterFee = amount.minus(fee)
                const purchase = await purchaseReturn(index, 0, 0, amountAfterFee)

                const receipt = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                const batchId = getBuyOrderBatchId(receipt)

                const tokensToBeMinted1 = await marketMaker.tokensToBeMinted()
                assert.equal(tokensToBeMinted1.toNumber(), purchase.toNumber())

                await progressToNextBatch()
                await marketMaker.claimBuyOrder(authorized, batchId, collaterals[index])

                const tokensToBeMinted2 = await marketMaker.tokensToBeMinted()
                assert.equal(tokensToBeMinted2.toNumber(), 0)
              })
            })

            context('> but there are no bonds to claim', () => {
              context('> because address has no pending buy order at all', () => {
                it('it should revert', async () => {
                  const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  const batchId = getBuyOrderBatchId(receipt)

                  await progressToNextBatch()

                  await assertRevert(() => marketMaker.claimBuyOrder(authorized2, batchId, collaterals[index]))
                })
              })

              context('> because address has a pending buy order but created through another collateral', () => {
                it('it should revert', async () => {
                  const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  const batchId = getBuyOrderBatchId(receipt)
                  const index_ = index === 1 ? 0 : 1

                  await progressToNextBatch()

                  await assertRevert(() => marketMaker.claimBuyOrder(authorized, batchId, collaterals[index_]))
                })
              })

              context('> because buy order has already been claimed', () => {
                it('it should revert', async () => {
                  const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  const batchId = getBuyOrderBatchId(receipt)

                  await progressToNextBatch()
                  await marketMaker.claimBuyOrder(authorized, batchId, collaterals[index])

                  await assertRevert(() => marketMaker.claimBuyOrder(authorized, batchId, collaterals[index]))
                })
              })
            })
          })

          context('> but batch is cancelled', () => {
            it('it should revert', async () => {
              const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const batchId = getBuyOrderBatchId(receipt)

              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
              await progressToNextBatch()

              // batch is now cancelled
              await assertRevert(() => marketMaker.claimBuyOrder(authorized, batchId, collaterals[index]))
            })
          })
        })

        context('> but batch is not yet over', () => {
          it('it should revert', async () => {
            const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt)

            await assertRevert(() => marketMaker.claimBuyOrder(authorized, batchId, collaterals[index]))
          })
        })
      })

      context('> but collateral is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })

          const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
          const batchId = getBuyOrderBatchId(receipt)

          await progressToNextBatch()

          await assertRevert(() => marketMaker.claimBuyOrder(authorized, batchId, unlisted.address))
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
          context('> and batch is not cancelled', () => {
            context('> and there are collateral to claim', () => {
              it('it should register claim', async () => {
                const receipt1 = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                const batchId = getSellOrderBatchId(receipt1)

                await progressToNextBatch()
                const receipt2 = await marketMaker.claimSellOrder(authorized, batchId, collaterals[index])

                assertEvent(receipt2, 'ClaimSellOrder')
              })

              it('it should return collateral', async () => {
                // let's define purchase amount and fee
                const amount1 = random.amount()
                const amount2 = random.amount()
                const fee1 = computeBuyFee(amount1)
                const fee2 = computeBuyFee(amount2)
                const amountAfterFee1 = amount1.minus(fee1)
                const amountAfterFee2 = amount2.minus(fee2)
                const amountAfterFee = amountAfterFee1.add(amountAfterFee2)
                // let's buy and claim bonds
                const balance1_ = await openAndClaimBuyOrder(authorized, collaterals[index], amount1, { from: authorized })
                const balance2_ = await openAndClaimBuyOrder(authorized2, collaterals[index], amount2, { from: authorized })
                const supply = balance1_.add(balance2_)
                // let's sell these bonds
                const receipt = await openSellOrder(authorized, collaterals[index], balance1_, { from: authorized })
                await openSellOrder(authorized2, collaterals[index], balance2_, { from: authorized })
                const batchId = getSellOrderBatchId(receipt)
                // let's save the actual collateral balance of the seller
                const balance11 = await getBalance(collaterals[index], authorized)
                const balance21 = await getBalance(collaterals[index], authorized2)
                // let's compute how much colleral should be transfered
                const sale = await saleReturn(index, supply, amountAfterFee, supply)
                // let's move to next batch
                await progressToNextBatch()
                // let's claim the collateral
                await marketMaker.claimSellOrder(authorized, batchId, collaterals[index])
                await marketMaker.claimSellOrder(authorized2, batchId, collaterals[index])
                // let's save the new collateral balance of the seller
                const balance12 = await getBalance(collaterals[index], authorized)
                const balance22 = await getBalance(collaterals[index], authorized2)
                // let's compute the expected collateral returns
                const expectedReturn1 = sale.mul(balance1_).div(supply)
                const expectedReturn2 = sale.mul(balance2_).div(supply)
                const expectedReturnAfterFee1 = expectedReturn1.minus(computeSellFee(expectedReturn1))
                const expectedReturnAfterFee2 = expectedReturn2.minus(computeSellFee(expectedReturn2))

                assert.equal(balance12.toNumber(), balance11.add(expectedReturnAfterFee1).toNumber())
                assert.equal(balance22.toNumber(), balance21.add(expectedReturnAfterFee2).toNumber())
              })

              it('it should deduct fee', async () => {
                // let's define purchase amount and fee
                const amount = random.amount()
                const fee = computeBuyFee(amount)
                const amountAfterFee = amount.minus(fee)
                // let's buy, claim and sell some bonds
                const balance_ = await openAndClaimBuyOrder(authorized, collaterals[index], amount, { from: authorized })
                const receipt1 = await openSellOrder(authorized, collaterals[index], balance_, { from: authorized })
                const batchId = getSellOrderBatchId(receipt1)
                // let's save the actual collateral balance of the beneficiary
                const balance1 = await getBalance(collaterals[index], beneficiary)
                // let's compute how much colleral should be transfered
                const sale = await saleReturn(index, balance_, amountAfterFee, balance_)
                const saleFee = computeSellFee(sale)
                // let's move to next batch
                await progressToNextBatch()
                // let's claim the collateral
                await marketMaker.claimSellOrder(authorized, batchId, collaterals[index])
                // let's save the new collateral balance of the beneficiary
                const balance2 = await getBalance(collaterals[index], beneficiary)

                assert.equal(balance2.toNumber(), balance1.add(saleFee).toNumber())
              })

              it('it should update the amount of collateral to be claimed', async () => {
                const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                const batchId = getSellOrderBatchId(receipt)
                const toBeClaimed1 = await marketMaker.collateralsToBeClaimed(collaterals[index])

                assert.isAbove(toBeClaimed1.toNumber(), 0)

                await progressToNextBatch()
                await marketMaker.claimSellOrder(authorized, batchId, collaterals[index])
                const toBeClaimed2 = await marketMaker.collateralsToBeClaimed(collaterals[index])

                assert.equal(toBeClaimed2.toNumber(), 0)
              })
            })

            context('> but there are no collateral to claim', () => {
              context('> because address has no pending sell order at all', () => {
                it('it should revert', async () => {
                  const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  const batchId = getSellOrderBatchId(receipt)

                  await progressToNextBatch()

                  await assertRevert(() => marketMaker.claimSellOrder(authorized2, batchId, collaterals[index]))
                })
              })

              context('> because address has a pending sell order but created through another collateral', () => {
                it('it should revert', async () => {
                  const _index = index === 1 ? 0 : 1

                  const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  const batchId = getSellOrderBatchId(receipt)

                  await progressToNextBatch()

                  await assertRevert(() => marketMaker.claimSellOrder(authorized, batchId, collaterals[_index]))
                })
              })

              context('> because sell order has already been claimed', () => {
                it('it should revert', async () => {
                  const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
                  const batchId = getSellOrderBatchId(receipt)

                  await progressToNextBatch()
                  await marketMaker.claimSellOrder(authorized, batchId, collaterals[index])

                  await assertRevert(() => marketMaker.claimSellOrder(authorized, batchId, collaterals[index]))
                })
              })
            })
          })

          context('> but batch is cancelled', () => {
            it('it should revert', async () => {
              const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const batchId = getSellOrderBatchId(receipt)

              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
              await progressToNextBatch()

              // batch is now cancelled
              await assertRevert(() => marketMaker.claimSellOrder(authorized, batchId, collaterals[index]))
            })
          })
        })

        context('> but batch is not yet over', () => {
          it('it should revert', async () => {
            const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const batchId = getSellOrderBatchId(receipt)

            await assertRevert(() => marketMaker.claimSellOrder(authorized, batchId, collaterals[index]))
          })
        })
      })

      context('> but collateral is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })

          const receipt = await openClaimAndSellBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
          const batchId = getSellOrderBatchId(receipt)

          await progressToNextBatch()

          await assertRevert(() => marketMaker.claimSellOrder(authorized, batchId, unlisted.address))
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
            const amount = random.amount()

            const receipt1 = await openBuyOrder(authorized, collaterals[index], amount, { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)

            await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
            const receipt2 = await marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index])

            assertEvent(receipt2, 'ClaimCancelledBuyOrder')
          })

          it('it should return collateral', async () => {
            const receipt1 = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)
            const _balance = await getBalance(collaterals[index], authorized)

            await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
            await marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index])
            const balance_ = await getBalance(collaterals[index], authorized)

            // can't assert exactly because of gas being spent
            assert.isAbove(balance_.toNumber(), _balance.toNumber())
          })

          it('it should update the amount of collateral to be claimed', async () => {
            const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt)

            await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
            await marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index])
            const collateralsToBeClaimed = await marketMaker.collateralsToBeClaimed(collaterals[index])

            assert.equal(collateralsToBeClaimed.toNumber(), 0)
          })
        })

        context('> but there are no collateral to claim', () => {
          context('> because address has no pending cancelled buy order at all', () => {
            it('it should revert', async () => {
              const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const batchId = getBuyOrderBatchId(receipt)
              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })

              await assertRevert(() => marketMaker.claimCancelledBuyOrder(authorized2, batchId, collaterals[index]))
            })
          })

          context('> because address has a pending cancelled buy order but created through another collateral', () => {
            it('it should revert', async () => {
              const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const batchId = getBuyOrderBatchId(receipt)
              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })

              const index_ = index === 1 ? 0 : 1

              await assertRevert(() => marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index_]))
            })
          })

          context('> because cancelled buy order has already been claimed', () => {
            it('it should revert', async () => {
              const receipt = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const batchId = getBuyOrderBatchId(receipt)
              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
              await marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index])

              // cancelled order is now already claimed
              await assertRevert(() => marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index]))
            })
          })
        })
      })

      context('> but batch is not cancelled', () => {
        it('it should revert', async () => {
          const receipt1 = await openBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
          const batchId = getBuyOrderBatchId(receipt1)

          await assertRevert(() => marketMaker.claimCancelledBuyOrder(authorized, batchId, collaterals[index]))
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
            const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const receipt1 = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
            const batchId = getSellOrderBatchId(receipt1)

            await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
            const receipt2 = await marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index])

            assertEvent(receipt2, 'ClaimCancelledSellOrder')
          })

          it('it should return bonds', async () => {
            const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
            const _balance = await getBalance(token.address, authorized)
            const batchId = getSellOrderBatchId(receipt)

            await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
            await marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index])
            const balance_ = await getBalance(token.address, authorized)

            assert.equal(balance_.toNumber(), _balance.add(balance).toNumber())
          })

          it('it should update the amount of tokens to be minted', async () => {
            const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
            const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
            const batchId = getSellOrderBatchId(receipt)

            await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
            await marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index])
            const tokensToBeMinted = await marketMaker.tokensToBeMinted()

            assert.equal(tokensToBeMinted.toNumber(), 0)
          })
        })

        context('> but there are no bond to claim', () => {
          context('> because address has no pending cancelled sell order at all', () => {
            it('it should revert', async () => {
              const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
              const batchId = getSellOrderBatchId(receipt)
              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })

              await assertRevert(() => marketMaker.claimCancelledSellOrder(authorized2, batchId, collaterals[index]))
            })
          })

          context('> because address has a pending cancelled sell order but created through another collateral', () => {
            it('it should revert', async () => {
              const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
              const batchId = getSellOrderBatchId(receipt)
              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })

              const index_ = index === 1 ? 0 : 1

              await assertRevert(() => marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index_]))
            })
          })

          context('> because cancelled sell order has already been claimed', () => {
            it('it should revert', async () => {
              const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
              const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
              const batchId = getSellOrderBatchId(receipt)
              await marketMaker.removeCollateralToken(collaterals[index], { from: authorized })
              await marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index])

              // cancelled order is now already claimed
              await assertRevert(() => marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index]))
            })
          })
        })
      })

      context('> but batch is not cancelled', () => {
        it('it should revert', async () => {
          const balance = await openAndClaimBuyOrder(authorized, collaterals[index], random.amount(), { from: authorized })
          const receipt = await openSellOrder(authorized, collaterals[index], balance, { from: authorized })
          const batchId = getSellOrderBatchId(receipt)

          await assertRevert(() => marketMaker.claimCancelledSellOrder(authorized, batchId, collaterals[index]))
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
          const amount1 = random.amount()
          const amount2 = random.amount()
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
          await marketMaker.claimBuyOrder(user1, batchId, collaterals[index])
          await marketMaker.claimBuyOrder(user2, batchId, collaterals[index])
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
          const buyAmount1 = random.amount()
          const buyAmount2 = random.amount()
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
          await marketMaker.claimSellOrder(user1, batchId, collaterals[index])
          await marketMaker.claimSellOrder(user2, batchId, collaterals[index])
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
            const staticPricePPM = await marketMaker.getStaticPricePPM(overallSupply, overallBalance, RESERVE_RATIOS[index])
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
            const staticPricePPM = await marketMaker.getStaticPricePPM(overallSupply, overallBalance, RESERVE_RATIOS[index])
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
