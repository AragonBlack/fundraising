/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
const assertEvent = require('@aragon/test-helpers/assertEvent')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const { hash } = require('eth-ens-namehash')
const Decimal = require('decimal.js')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const Controller = artifacts.require('SimpleMarketMakerController')
const TokenManager = artifacts.require('TokenManager')
const Pool = artifacts.require('Pool')
const Formula = artifacts.require('BancorFormula.sol')
const BancorMarketMaker = artifacts.require('BancorMarketMaker')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}

const getBuyOrderBatchId = receipt => {
  const event = receipt.logs.find(l => l.event === 'NewBuyOrder')
  return event.args.batchId
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

contract('BancorMarketMaker app', accounts => {
  let factory, dao, acl, cBase, tBase, pBase, bBase, token, tokenManager, controller, pool, formula, curve, token1, token2
  let ETH,
    APP_MANAGER_ROLE,
    MINT_ROLE,
    BURN_ROLE,
    ADD_COLLATERAL_TOKEN_ROLE,
    UPDATE_COLLATERAL_TOKEN_ROLE,
    UPDATE_FEE_ROLE,
    UPDATE_GAS_COSTS_ROLE,
    CREATE_BUY_ORDER_ROLE,
    CREATE_SELL_ORDER_ROLE,
    TRANSFER_ROLE

  const POOL_ID = hash('pool.aragonpm.eth')
  const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
  const CONTROLLER_ID = hash('controller.aragonpm.eth')
  const BANCOR_CURVE_ID = hash('vault.aragonpm.eth')

  const PPM = 1000000
  const INITIAL_TOKEN_BALANCE = 1000000000000

  const BLOCKS_IN_BATCH = 10
  const FEE_PERCENT = 10000
  const BUY_GAS = 0
  const SELL_GAS = 0

  const VIRTUAL_SUPPLIES = [randomVirtualSupply(), randomVirtualSupply(), randomVirtualSupply()]
  const VIRTUAL_BALANCES = [randomVirtualBalance(), randomVirtualBalance(), randomVirtualBalance()]
  const RESERVE_RATIOS = [randomReserveRatio(), randomReserveRatio(), randomReserveRatio()]

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
    await acl.createPermission(authorized, curve.address, UPDATE_FEE_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, UPDATE_GAS_COSTS_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, CREATE_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, curve.address, CREATE_SELL_ORDER_ROLE, root, { from: root })
    await acl.grantPermission(authorized2, curve.address, ADD_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_COLLATERAL_TOKEN_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_FEE_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, UPDATE_GAS_COSTS_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, CREATE_BUY_ORDER_ROLE, { from: root })
    await acl.grantPermission(authorized2, curve.address, CREATE_SELL_ORDER_ROLE, { from: root })
    // collaterals
    token1 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE * 2)
    token2 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE * 2)
    await token1.transfer(authorized2, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token2.transfer(authorized2, INITIAL_TOKEN_BALANCE, { from: authorized })
    // allowances
    await token1.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token2.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    await token1.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized2 })
    await token2.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized2 })
    // initializations
    await token.changeController(tokenManager.address)
    await tokenManager.initialize(token.address, true, 0)
    await pool.initialize()
    await controller.initialize(pool.address, curve.address, beneficiary)
    await curve.initialize(controller.address, tokenManager.address, pool.address, beneficiary, formula.address, BLOCKS_IN_BATCH, FEE_PERCENT)
    // end up initializing market maker
    await curve.updateGasCosts(BUY_GAS, SELL_GAS, { from: authorized })
    await curve.addCollateralToken(ETH, VIRTUAL_SUPPLIES[0], VIRTUAL_BALANCES[0], RESERVE_RATIOS[0], { from: authorized })
    await curve.addCollateralToken(token1.address, VIRTUAL_SUPPLIES[1], VIRTUAL_BALANCES[1], RESERVE_RATIOS[1], { from: authorized })
    await curve.addCollateralToken(token2.address, VIRTUAL_SUPPLIES[2], VIRTUAL_BALANCES[2], RESERVE_RATIOS[2], { from: authorized })
    // make sure tests start at the beginning of a new batch
    await progressToNextBatch()
  }

  const randomAmount = () => {
    return new web3.BigNumber(Math.floor(Math.random() * Math.floor(INITIAL_TOKEN_BALANCE / 3)) + 1)
  }

  const computeFee = amount => {
    return amount
      .times(FEE_PERCENT)
      .div(PPM)
      .round(0)
  }

  const getBatch = async (collateralToken, batchNumber) => {
    let [initialized, cleared, poolBalance, totalSupply, totalBuySpend, totalBuyReturn, totalSellSpend, totalSellReturn] = await curve.getBatch(
      collateralToken,
      batchNumber
    )
    return {
      initialized,
      cleared,
      poolBalance,
      totalSupply,
      totalBuySpend,
      totalBuyReturn,
      totalSellSpend,
      totalSellReturn,
    }
  }

  const getCollateralTokenInfo = async collateralToken => {
    const [exists, virtualSupply, virtualBalance, reserveRatio] = await curve.getCollateralTokenInfo(collateralToken)

    return { exists, virtualSupply, virtualBalance, reserveRatio }
  }

  const createAndClaimBuyOrder = async ({ address, collateralToken, amount, from }) => {
    from = from || address
    // create buy order
    const receipt = await curve.createBuyOrder(address, collateralToken, amount, { from, value: collateralToken === ETH ? amount : 0 })
    const event = receipt.logs.find(l => l.event === 'NewBuyOrder')
    const batchId = event.args.batchId.toNumber()
    // move to next batch
    await increaseBlocks(BLOCKS_IN_BATCH)
    // clear batch
    await curve.clearBatches()
    // claim bonds
    await curve.claimBuy(address, collateralToken, batchId)
    // return balance
    const balance = await token.balanceOf(address)

    return balance
  }

  const progressToNextBatch = async () => {
    let currentBlock = await blockNumber()
    let currentBatch = await curve.getCurrentBatchId()
    let blocksTilNextBatch = currentBatch.add(10).sub(currentBlock)
    await increaseBlocks(blocksTilNextBatch)
  }

  const increaseBlocks = blocks => {
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

  const increaseBlock = () => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.sendAsync({ jsonrpc: '2.0', method: 'evm_mine', id: 12345 }, (err, result) => {
        if (err) reject(err)
        resolve(result)
      })
    })
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
    UPDATE_FEE_ROLE = await bBase.UPDATE_FEE_ROLE()
    UPDATE_GAS_COSTS_ROLE = await bBase.UPDATE_GAS_COSTS_ROLE()
    CREATE_BUY_ORDER_ROLE = await bBase.CREATE_BUY_ORDER_ROLE()
    CREATE_SELL_ORDER_ROLE = await bBase.CREATE_SELL_ORDER_ROLE()
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
        assert.equal(await curve.pool(), pool.address)
        assert.equal(await curve.beneficiary(), beneficiary)
        assert.equal(await curve.formula(), formula.address)
        assert.equal(await curve.batchBlocks(), BLOCKS_IN_BATCH)
        assert.equal(await curve.feePercentPPM(), FEE_PERCENT)
      })
    })

    context('> initialization parameters are not correct', () => {
      it('it should revert [controller is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(authorized, tokenManager.address, pool.address, beneficiary, formula.address, BLOCKS_IN_BATCH, FEE_PERCENT, { from: root })
        )
      })

      it('it should revert [token manager is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(controller.address, authorized, pool.address, beneficiary, formula.address, BLOCKS_IN_BATCH, FEE_PERCENT, { from: root })
        )
      })

      it('it should revert [pool is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(controller.address, tokenManager.address, authorized, beneficiary, formula.address, BLOCKS_IN_BATCH, FEE_PERCENT, {
            from: root,
          })
        )
      })

      it('it should revert [formula is not a contract]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(controller.address, tokenManager.address, pool.address, beneficiary, authorized, BLOCKS_IN_BATCH, FEE_PERCENT, {
            from: root,
          })
        )
      })

      it('it should revert [batchBlocks is zero]', async () => {
        const bReceipt = await dao.newAppInstance(BANCOR_CURVE_ID, bBase.address, '0x', false)
        const uninitialized = await BancorMarketMaker.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))

        assertRevert(() =>
          uninitialized.initialize(controller.address, tokenManager.address, pool.address, beneficiary, formula.address, 0, FEE_PERCENT, { from: root })
        )
      })
    })

    it('it should revert on re-initialization', async () => {
      assertRevert(() =>
        curve.initialize(controller.address, tokenManager.address, pool.address, beneficiary, formula.address, BLOCKS_IN_BATCH, FEE_PERCENT, { from: root })
      )
    })
  })
  // #endregion

  // #region addCollateralToken
  context('> #addCollateralToken', () => {
    context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      context('> and collateral token has not yet been added', () => {
        context('> and collateral token is ETH or ERC20 [i.e. contract]', () => {
          it('it should add collateral token', async () => {
            const virtualSupply = randomVirtualSupply()
            const virtualBalance = randomVirtualBalance()
            const reserveRatio = randomReserveRatio()
            const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

            const receipt = await curve.addCollateralToken(unlisted.address, virtualSupply, virtualBalance, reserveRatio, { from: authorized })
            const info = await getCollateralTokenInfo(unlisted.address)

            assertEvent(receipt, 'AddCollateralToken')
            assert.equal((await curve.collateralTokensLength()).toNumber(), 4)
            assert.equal(await curve.collateralTokens(0), ETH)
            assert.equal(await curve.collateralTokens(1), token1.address)
            assert.equal(await curve.collateralTokens(2), token2.address)
            assert.equal(await curve.collateralTokens(3), unlisted.address)
            assert.equal(info.exists, true)
            assert.equal(info.virtualSupply.toNumber(), virtualSupply)
            assert.equal(info.virtualBalance.toNumber(), virtualBalance)
            assert.equal(info.reserveRatio.toNumber(), reserveRatio)
          })
        })

        context('> but collateral token is not ETH or ERC20 [i.e. contract]', () => {
          it('it should revert', async () => {
            await assertRevert(() =>
              curve.addCollateralToken(authorized, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: authorized })
            )
          })
        })
      })

      context('> but collateral token has already been added', () => {
        it('it should revert', async () => {
          await assertRevert(() => curve.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: authorized }))
        })
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

        await assertRevert(() =>
          curve.addCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: unauthorized })
        )
      })
    })
  })
  // #endregion

  // #region updateCollateralToken
  context('> #updateCollateralToken', () => {
    context('> sender has UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      context('> and collateral token is whitelisted', () => {
        it('it should update collateral token', async () => {
          const virtualSupply = randomVirtualSupply()
          const virtualBalance = randomVirtualBalance()
          const reserveRatio = randomReserveRatio()
          const receipt = await curve.updateCollateralToken(token1.address, virtualSupply, virtualBalance, reserveRatio, { from: authorized })
          const info = await getCollateralTokenInfo(token1.address)

          assertEvent(receipt, 'UpdateCollateralToken')
          assert.equal(info.virtualSupply.toNumber(), virtualSupply)
          assert.equal(info.virtualBalance.toNumber(), virtualBalance)
          assert.equal(info.reserveRatio.toNumber(), reserveRatio)
        })
      })

      context('> but collateral token is not whitelisted', () => {
        it('it should revert', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)

          await assertRevert(() =>
            curve.updateCollateralToken(unlisted.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: authorized })
          )
        })
      })
    })

    context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          curve.updateCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), { from: unauthorized })
        )
      })
    })
  })
  // #endregion

  // #region updateFees
  context('> #updateFee', () => {
    context('> sender has UPDATE_FEE_ROLE', () => {
      it('it should update fee', async () => {
        const receipt = await curve.updateFee(40, { from: authorized })

        assertEvent(receipt, 'UpdateFee')
        assert.equal((await curve.feePercentPPM()).toNumber(), 40)
      })
    })

    context('> sender does not have UPDATE_FEE_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => curve.updateFee(40, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateGasCosts
  context('> #updateGasCosts', () => {
    context('> sender has UPDATE_GAS_COSTS_ROLE', () => {
      it('it should update gas costs', async () => {
        const receipt = await curve.updateGasCosts(15, 23, { from: authorized })

        assertEvent(receipt, 'UpdateGasCosts')
        assert.equal((await curve.gasCostBuyOrder()).toNumber(), 15)
        assert.equal((await curve.gasCostSellOrder()).toNumber(), 23)
      })
    })

    context('> sender does not have UPDATE_GAS_COSTS_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => curve.updateGasCosts(15, 23, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region createBuyOrder
  context('> #createBuyOrder', () => {
    context('> sender has CREATE_BUY_ORDER_ROLE', () => {
      context('> and collateral is whitelisted', () => {
        context('> and value is not zero', () => {
          context('> and sender has sufficient funds', () => {
            context('> ETH', () => {
              it('it should initialize and update token batch', async () => {
                const amount = randomAmount()
                const receipt = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })

                const batchId = getBuyOrderBatchId(receipt)
                const batch = await getBatch(ETH, batchId)
                const fee = computeFee(amount)

                assert.equal(batch.initialized, true)
                assert.equal(batch.cleared, false)
                assert.equal(batch.poolBalance.toNumber(), 0)
                assert.equal(batch.totalSupply.toNumber(), 0)
                assert.equal(batch.totalBuySpend.toNumber(), amount.minus(fee).toNumber())
                assert.equal(batch.totalBuyReturn.toNumber(), 0)
                assert.equal(batch.totalSellSpend.toNumber(), 0)
                assert.equal(batch.totalSellReturn.toNumber(), 0)
              })

              it('it should create buy order', async () => {
                const amount = randomAmount()
                const receipt = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
                const fee = computeFee(amount)

                assertEvent(receipt, 'NewBuyOrder')
                assert.equal((await web3.eth.getBalance(pool.address)).toNumber(), amount.minus(fee))
              })

              it('it should deduct fee', async () => {
                const oldBeneficiaryBalance = await web3.eth.getBalance(beneficiary)
                const amount = randomAmount()
                const receipt = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })

                const batchId = getBuyOrderBatchId(receipt)
                const batch = await getBatch(ETH, batchId)
                const fee = computeFee(amount)
                const newBeneficiaryBalance = await web3.eth.getBalance(beneficiary)

                assert.equal(newBeneficiaryBalance.minus(oldBeneficiaryBalance).toNumber(), fee.toNumber())
                assert.equal(batch.totalBuySpend.toNumber(), amount.minus(fee).toNumber())
              })

              it('it should clear previous batch', async () => {
                // initialize two different collaterals in the same batch [no need to test with sell orders because buy and sell orders are registered in the same batch]
                const amount1 = randomAmount()
                const receipt1 = await curve.createBuyOrder(authorized, ETH, amount1, { from: authorized, value: amount1 })
                const receipt2 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
                // assert that these two orders have the same batchId
                const batchId1 = getBuyOrderBatchId(receipt1)
                const batchId2 = getBuyOrderBatchId(receipt2)
                assert.equal(batchId1.toNumber(), batchId2.toNumber())
                // move to next batch
                await progressToNextBatch()
                // create a buy order in this next batch
                const amount2 = randomAmount()
                const receipt3 = await curve.createBuyOrder(authorized, ETH, amount2, { from: authorized, value: amount2 })
                // get previous collateral batches
                const batchETH = await getBatch(ETH, batchId1)
                const batchToken1 = await getBatch(token1.address, batchId2)
                // assert that these previous collateral batches are cleared
                assertEvent(receipt3, 'ClearBatch', 3) // batch is cleared for token2 even though there was no order
                assert.equal(batchETH.cleared, true)
                assert.equal(batchToken1.cleared, true)
              })
            })

            context('> ERC20', () => {
              it('it should initialize and update token batch', async () => {
                const amount = randomAmount()
                const receipt = await curve.createBuyOrder(authorized, token1.address, amount, { from: authorized })

                const batchId = getBuyOrderBatchId(receipt)
                const batch = await getBatch(token1.address, batchId)
                const fee = computeFee(amount)

                assert.equal(batch.initialized, true)
                assert.equal(batch.cleared, false)
                assert.equal(batch.poolBalance.toNumber(), 0)
                assert.equal(batch.totalSupply.toNumber(), 0)
                assert.equal(batch.totalBuySpend.toNumber(), amount.minus(fee).toNumber())
                assert.equal(batch.totalBuyReturn.toNumber(), 0)
                assert.equal(batch.totalSellSpend.toNumber(), 0)
                assert.equal(batch.totalSellReturn.toNumber(), 0)
              })

              it('it should create buy order', async () => {
                const amount = randomAmount()
                const receipt = await curve.createBuyOrder(authorized, token1.address, amount, { from: authorized })
                const fee = computeFee(amount)

                assertEvent(receipt, 'NewBuyOrder')
                assert.equal((await token1.balanceOf(pool.address)).toNumber(), amount.minus(fee))
              })

              it('it should deduct fee', async () => {
                const amount = randomAmount()
                const receipt = await curve.createBuyOrder(authorized, token1.address, amount, { from: authorized })

                const batchId = getBuyOrderBatchId(receipt)
                const batch = await getBatch(token1.address, batchId)
                const fee = computeFee(amount)

                assert.equal((await token1.balanceOf(beneficiary)).toNumber(), fee.toNumber())
                assert.equal(batch.totalBuySpend.toNumber(), amount.minus(fee).toNumber())
              })

              it('it should clear previous batch', async () => {
                // initialize two different collaterals in the same batch [no need to test with sell orders because buy and sell orders are registered in the same batch]
                const amount = randomAmount()
                const receipt1 = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
                const receipt2 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
                // assert that these two orders have the same batchId
                const batchId1 = getBuyOrderBatchId(receipt1)
                const batchId2 = getBuyOrderBatchId(receipt2)
                assert.equal(batchId1.toNumber(), batchId2.toNumber())
                // move to next batch
                await progressToNextBatch()
                // create a buy order in this next batch
                const receipt3 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
                // get previous collateral batches
                const batchETH = await getBatch(ETH, batchId1)
                const batchToken1 = await getBatch(token1.address, batchId2)
                // assert that these previous collateral batches are cleared
                assertEvent(receipt3, 'ClearBatch', 3) // batch is cleared for token2 even though there was no order
                assert.equal(batchETH.cleared, true)
                assert.equal(batchToken1.cleared, true)
              })
            })

            context('> and there are multiple orders', () => {
              it('it should batch orders', () => {
                // already tested in #createSellOrder
              })
            })
          })
        })

        context('> but sender does not have sufficient funds', () => {
          it('it should revert [ETH]', async () => {
            const amount = randomAmount()

            await assertRevert(() => curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount.minus(1) }))
          })

          it('it should revert [ERC20]', async () => {
            await assertRevert(() => curve.createBuyOrder(authorized, token1.address, INITIAL_TOKEN_BALANCE + 1, { from: authorized }))
          })
        })

        context('> but value is zero', () => {
          it('it should revert [ETH]', async () => {
            await assertRevert(() => curve.createBuyOrder(authorized, ETH, 0, { from: authorized, value: 10 }))
          })

          it('it should revert [ERC20]', async () => {
            await assertRevert(() => curve.createBuyOrder(authorized, token1.address, 0, { from: authorized }))
          })
        })
      })

      context('> but collateral is not whitelisted', () => {
        it('it should revert [ETH]', async () => {
          // we can't test unless we re-deploy a DAO without ETH as a whitelisted collateral just for that use case
          // it's not worth it because the logic is the same than ERC20 anyhow
        })

        it('it should revert [ERC20]', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })

          await assertRevert(() => curve.createBuyOrder(authorized, unlisted.address, randomAmount(), { from: authorized }))
        })
      })
    })

    context('> sender does not have CREATE_BUY_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        const amount = randomAmount()
        await assertRevert(() => curve.createBuyOrder(unauthorized, ETH, amount, { from: unauthorized, value: amount }))
      })

      it('it should revert [ERC20]', async () => {
        await assertRevert(() => curve.createBuyOrder(unauthorized, token1.address, randomAmount(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region createSellOrder
  context('> #createSellOrder', () => {
    context('> sender has CREATE_SELL_ORDER_ROLE', () => {
      context('> and collateral is whitelisted', () => {
        context('> and amount is not zero', () => {
          context('> and sender has sufficient funds', () => {
            context('> ETH', () => {
              it('it should initialize and update token batch', async () => {
                const amount = randomAmount()
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: amount })
                const receipt = await curve.createSellOrder(authorized, ETH, balance, { from: authorized, value: balance })

                const batchId = getSellOrderBatchId(receipt)
                const batch = await getBatch(ETH, batchId)
                const buyFee = computeFee(amount)
                const sellFee = computeFee(balance)

                assert.equal(batch.initialized, true)
                assert.equal(batch.cleared, false)
                assert.equal(batch.poolBalance.toNumber(), amount.minus(buyFee).toNumber())
                assert.equal(batch.totalSupply.toNumber(), balance.toNumber())
                assert.equal(batch.totalBuySpend.toNumber(), 0)
                assert.equal(batch.totalBuyReturn.toNumber(), 0)
                assert.equal(batch.totalSellSpend.toNumber(), balance.minus(sellFee).toNumber())
                assert.equal(batch.totalSellReturn.toNumber(), 0)
              })

              it('it should create sell order', async () => {
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
                const receipt = await curve.createSellOrder(authorized, ETH, balance, { from: authorized, value: balance })
                const fee = computeFee(balance)

                assertEvent(receipt, 'NewSellOrder')
                assert.equal((await token.totalSupply()).toNumber(), fee.toNumber())
              })

              it('it should deduct fee', async () => {
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
                const receipt = await curve.createSellOrder(authorized, ETH, balance, { from: authorized, value: balance })

                const batchId = getSellOrderBatchId(receipt)
                const batch = await getBatch(ETH, batchId)
                const fee = computeFee(balance)

                assert((await token.balanceOf(beneficiary)).toNumber(), fee.toNumber())
                assert.equal(batch.totalSellSpend.toNumber(), balance.minus(fee).toNumber())
              })

              it('it should clear previous batch', async () => {
                // buy bonded tokens to sell them afterwards
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
                // initialize two different collaterals in the same batch [no need to test with sell orders because buy and sell orders are registered in the same batch]
                const amount1 = randomAmount()
                const receipt1 = await curve.createBuyOrder(authorized, ETH, amount1, { from: authorized, value: amount1 })
                const receipt2 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
                // assert that these two orders have the same batchId
                const batchId1 = getBuyOrderBatchId(receipt1)
                const batchId2 = getBuyOrderBatchId(receipt2)
                assert.equal(batchId1.toNumber(), batchId2.toNumber())
                // move to next batch
                await progressToNextBatch()
                // create a sell order in this next batch
                const receipt3 = await curve.createSellOrder(authorized, ETH, balance, { from: authorized, value: balance })
                // get previous collateral batches
                const batchETH = await getBatch(ETH, batchId1)
                const batchToken1 = await getBatch(token1.address, batchId2)
                // assert that these previous collateral batches are cleared
                assertEvent(receipt3, 'ClearBatch', 3) // batch is cleared for token2 even though there was no order
                assert.equal(batchETH.cleared, true)
                assert.equal(batchToken1.cleared, true)
              })
            })

            context('> and there are multiple orders', () => {
              it('it should batch orders', async () => {
                // already tested in the ERC20 version of the test below
              })
            })

            context('> ERC20', () => {
              it('it should initialize and update token batch', async () => {
                const amount = randomAmount()
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: amount })
                const receipt = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })

                const batchId = getSellOrderBatchId(receipt)
                const batch = await getBatch(token1.address, batchId)
                const buyFee = computeFee(amount)
                const sellFee = computeFee(balance)

                assert.equal(batch.initialized, true)
                assert.equal(batch.cleared, false)
                assert.equal(batch.poolBalance.toNumber(), amount.minus(buyFee).toNumber())
                assert.equal(batch.totalSupply.toNumber(), balance.toNumber())
                assert.equal(batch.totalBuySpend.toNumber(), 0)
                assert.equal(batch.totalBuyReturn.toNumber(), 0)
                assert.equal(batch.totalSellSpend.toNumber(), balance.minus(sellFee).toNumber())
                assert.equal(batch.totalSellReturn.toNumber(), 0)
              })

              it('it should create sell order', async () => {
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
                const receipt = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })
                const fee = computeFee(balance)

                assertEvent(receipt, 'NewSellOrder')
                assert.equal((await token.totalSupply()).toNumber(), fee.toNumber())
              })

              it('it should deduct fee', async () => {
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
                const receipt = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })

                const batchId = getSellOrderBatchId(receipt)
                const batch = await getBatch(token1.address, batchId)
                const fee = computeFee(balance)

                assert((await token.balanceOf(beneficiary)).toNumber(), fee.toNumber())
                assert.equal(batch.totalSellSpend.toNumber(), balance.minus(fee).toNumber())
              })

              it('it should clear previous batch', async () => {
                // buy bonded tokens to sell them afterwards
                const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
                // initialize two different collaterals in the same batch [no need to test with sell orders because buy and sell orders are registered in the same batch]
                const amount1 = randomAmount()
                const receipt1 = await curve.createBuyOrder(authorized, ETH, amount1, { from: authorized, value: amount1 })
                const receipt2 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
                // assert that these two orders have the same batchId
                const batchId1 = getBuyOrderBatchId(receipt1)
                const batchId2 = getBuyOrderBatchId(receipt2)
                assert.equal(batchId1.toNumber(), batchId2.toNumber())
                // move to next batch
                await progressToNextBatch()
                // create a sell order in this next batch
                const receipt3 = await curve.createSellOrder(authorized, token1.address, balance, { from: authorized })
                // get previous collateral batches
                const batchETH = await getBatch(ETH, batchId1)
                const batchToken1 = await getBatch(token1.address, batchId2)
                // assert that these previous collateral batches are cleared
                assertEvent(receipt3, 'ClearBatch', 3) // batch is cleared for token2 even though there was no order
                assert.equal(batchETH.cleared, true)
                assert.equal(batchToken1.cleared, true)
              })
            })

            context('> and there are multiple orders', () => {
              it('it should batch orders', async () => {
                // compute random amounts
                const amountETH1 = randomAmount()
                const amountETH2 = randomAmount()
                const amountToken11 = randomAmount()
                const amountToken12 = randomAmount()
                const amountToken21 = randomAmount()
                const amountToken22 = randomAmount()
                // create and claim some buy orders
                await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: amountETH1 })
                const balance1 = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: amountToken11 })
                const balance2 = await createAndClaimBuyOrder({ address: authorized2, collateralToken: token2.address, amount: amountToken22 })
                // move to next batch
                await progressToNextBatch()
                // create some buy and sell orders
                const third = balance1.div(3).round(0)
                const receipt1 = await curve.createSellOrder(authorized, token1.address, third, { from: authorized })
                const receipt2 = await curve.createSellOrder(authorized, ETH, third, { from: authorized })
                const receipt3 = await curve.createBuyOrder(authorized, token2.address, amountToken21, { from: authorized })
                const receipt4 = await curve.createSellOrder(authorized2, token2.address, balance2, { from: authorized2 })
                const receipt5 = await curve.createBuyOrder(authorized2, token1.address, amountToken12, { from: authorized2 })
                const receipt6 = await curve.createBuyOrder(authorized2, ETH, amountETH2, { from: authorized2, value: amountETH2 })
                // assert that the orders have all been registered
                assertEvent(receipt1, 'NewSellOrder')
                assertEvent(receipt2, 'NewSellOrder')
                assertEvent(receipt3, 'NewBuyOrder')
                assertEvent(receipt4, 'NewSellOrder')
                assertEvent(receipt5, 'NewBuyOrder')
                assertEvent(receipt6, 'NewBuyOrder')
                // assert that the orders are all in the same batch
                const batchId1 = getSellOrderBatchId(receipt1)
                const batchId2 = getSellOrderBatchId(receipt2)
                const batchId3 = getBuyOrderBatchId(receipt3)
                const batchId4 = getSellOrderBatchId(receipt4)
                const batchId5 = getBuyOrderBatchId(receipt5)
                const batchId6 = getBuyOrderBatchId(receipt6)
                assert.equal(batchId1, batchId2)
                assert.equal(batchId1, batchId3)
                assert.equal(batchId1, batchId4)
                assert.equal(batchId1, batchId5)
                assert.equal(batchId1, batchId6)
                // assert that ETH batch is correct
                const batchETH = await getBatch(ETH, batchId1)
                const buyFeeETH1 = computeFee(amountETH1)
                const buyFeeETH2 = computeFee(amountETH2)
                const sellFeeETH = computeFee(third)
                assert.equal(batchETH.initialized, true)
                assert.equal(batchETH.cleared, false)
                assert.equal(batchETH.poolBalance.toNumber(), amountETH1.minus(buyFeeETH1).toNumber())
                assert.equal(batchETH.totalSupply.toNumber(), balance1.plus(balance2).toNumber())
                assert.equal(batchETH.totalBuySpend.toNumber(), amountETH2.minus(buyFeeETH2).toNumber())
                assert.equal(batchETH.totalBuyReturn.toNumber(), 0)
                assert.equal(batchETH.totalSellSpend.toNumber(), third.minus(sellFeeETH).toNumber())
                assert.equal(batchETH.totalSellReturn.toNumber(), 0)
                // assert that token1 batch is correct
                const batch1 = await getBatch(token1.address, batchId1)
                const buyFeeToken11 = computeFee(amountToken11)
                const buyFeeToken12 = computeFee(amountToken12)
                const sellFeeToken1 = computeFee(third)
                assert.equal(batch1.initialized, true)
                assert.equal(batch1.cleared, false)
                assert.equal(batch1.poolBalance.toNumber(), amountToken11.minus(buyFeeToken11).toNumber())
                assert.equal(batch1.totalSupply.toNumber(), balance1.plus(balance2).toNumber())
                assert.equal(batch1.totalBuySpend.toNumber(), amountToken12.minus(buyFeeToken12).toNumber())
                assert.equal(batch1.totalBuyReturn.toNumber(), 0)
                assert.equal(batch1.totalSellSpend.toNumber(), third.minus(sellFeeToken1).toNumber())
                assert.equal(batch1.totalSellReturn.toNumber(), 0)
                // assert that token2 batch is correct
                const batch2 = await getBatch(token2.address, batchId1)
                const buyFeeToken21 = computeFee(amountToken21)
                const buyFeeToken22 = computeFee(amountToken22)
                const sellFeeToken2 = computeFee(balance2)
                assert.equal(batch2.initialized, true)
                assert.equal(batch2.cleared, false)
                assert.equal(batch2.poolBalance.toNumber(), amountToken22.minus(buyFeeToken22).toNumber())
                assert.equal(batch2.totalSupply.toNumber(), balance1.plus(balance2).toNumber())
                assert.equal(batch2.totalBuySpend.toNumber(), amountToken21.minus(buyFeeToken21).toNumber())
                assert.equal(batch2.totalBuyReturn.toNumber(), 0)
                assert.equal(batch2.totalSellSpend.toNumber(), balance2.minus(sellFeeToken2).toNumber())
                assert.equal(batch2.totalSellReturn.toNumber(), 0)
              })
            })
          })

          context('> but sender does not have sufficient funds', () => {
            it('it should revert [ETH]', async () => {
              const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

              await assertRevert(() => curve.createSellOrder(authorized, ETH, balance.plus(10), { from: authorized }))
            })

            it('it should revert [ERC20]', async () => {
              const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

              await assertRevert(() => curve.createSellOrder(authorized, token1.address, balance.plus(10), { from: authorized }))
            })
          })
        })

        context('> but amount is zero', () => {
          it('it should revert [ETH]', async () => {
            await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

            await assertRevert(() => curve.createSellOrder(authorized, ETH, 0, { from: authorized }))
          })

          it('it should revert [ERC20]', async () => {
            await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

            await assertRevert(() => curve.createSellOrder(authorized, token1.address, 0, { from: authorized }))
          })
        })
      })

      context('> but collateral is not whitelisted', () => {
        it('it should revert [ETH]', async () => {
          // we can't test unless we re-deploy a DAO without ETH as a whitelisted collateral just for that use case
          // it's not worth it because the logic is the same than ERC20 anyhow
        })

        it('it should revert [ERC20]', async () => {
          const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
          await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })
          const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

          await assertRevert(() => curve.createSellOrder(authorized, unlisted.address, balance, { from: authorized }))
        })
      })
    })

    context('> sender does not have CREATE_SELL_ORDER_ROLE', () => {
      it('it should revert', async () => {
        const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
        await token.transfer(unauthorized, balance, { from: authorized })
        // test both ETH and ERC20
        await assertRevert(() => curve.createSellOrder(unauthorized, ETH, balance, { from: unauthorized }))
        await assertRevert(() => curve.createSellOrder(unauthorized, token1.address, balance, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region clearBatches
  context('> #clearBatches', () => {
    context('> batch has not yet been cleared', () => {
      context('> and batch period is over', () => {
        it('it should clear pending batches for all collateral tokens', async () => {
          // compute random amounts
          const amountETH1 = randomAmount()
          const amountETH2 = randomAmount()
          const amountToken11 = randomAmount()
          const amountToken12 = randomAmount()
          const amountToken21 = randomAmount()
          const amountToken22 = randomAmount()
          // create and claim some buy orders
          await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: amountETH1 })
          const balance1 = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: amountToken11 })
          const balance2 = await createAndClaimBuyOrder({ address: authorized2, collateralToken: token2.address, amount: amountToken22 })
          // move to next batch
          await progressToNextBatch()
          // create some buy and sell orders
          const third = balance1.div(3).round(0)
          const receipt1 = await curve.createSellOrder(authorized, token1.address, third, { from: authorized })
          const receipt2 = await curve.createSellOrder(authorized, ETH, third, { from: authorized })
          const receipt3 = await curve.createBuyOrder(authorized, token2.address, amountToken21, { from: authorized })
          const receipt4 = await curve.createSellOrder(authorized2, token2.address, balance2, { from: authorized2 })
          const receipt5 = await curve.createBuyOrder(authorized2, token1.address, amountToken12, { from: authorized2 })
          const receipt6 = await curve.createBuyOrder(authorized2, ETH, amountETH2, { from: authorized2, value: amountETH2 })
          // move to next batch
          await progressToNextBatch()
          // clear batches
          const receipt = await curve.clearBatches()
          // assert that the orders are all in the same batch
          const batchId1 = getSellOrderBatchId(receipt1)
          const batchId2 = getSellOrderBatchId(receipt2)
          const batchId3 = getBuyOrderBatchId(receipt3)
          const batchId4 = getSellOrderBatchId(receipt4)
          const batchId5 = getBuyOrderBatchId(receipt5)
          const batchId6 = getBuyOrderBatchId(receipt6)
          assert.equal(batchId1, batchId2)
          assert.equal(batchId1, batchId3)
          assert.equal(batchId1, batchId4)
          assert.equal(batchId1, batchId5)
          assert.equal(batchId1, batchId6)
          // assert that the ClearBatch event has been fired for each token batch
          assertEvent(receipt, 'ClearBatch', 3)
          // assert that ETH batch has been cleared
          const batchETH = await getBatch(ETH, batchId1)
          assert.equal(batchETH.cleared, true)
          assert.isAbove(batchETH.totalBuyReturn.toNumber(), 0)
          assert.isAbove(batchETH.totalSellReturn.toNumber(), 0)
          // assert that token1 batch has been cleared
          const batch1 = await getBatch(token1.address, batchId1)
          assert.equal(batch1.cleared, true)
          assert.isAbove(batch1.totalBuyReturn.toNumber(), 0)
          assert.isAbove(batch1.totalSellReturn.toNumber(), 0)
          // assert that token2 batch has been cleared
          const batch2 = await getBatch(token2.address, batchId1)
          assert.equal(batch2.cleared, true)
          assert.isAbove(batch2.totalBuyReturn.toNumber(), 0)
          assert.isAbove(batch2.totalSellReturn.toNumber(), 0)
          // assert that waitingClear has been re-initialized
          assert.equal(await curve.waitingClear(), 0)

          // TODO: had assert tests for clear matching / total buy and sell return math stuff here ?
        })
      })

      context('> but batch period is not over', () => {
        it('it should revert', async () => {
          await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })

          await assertRevert(() => curve.clearBatches())
        })
      })
    })

    context('> batch has already been cleared', () => {
      it('it should revert', async () => {
        await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
        await progressToNextBatch()
        await curve.clearBatches()
        // batch is now cleared
        await assertRevert(() => curve.clearBatches())
      })
    })
  })
  // #endregion

  // #region claimBuy
  context('> #claimBuy', () => {
    context('> collateral is whitelisted', () => {
      context('> and there are bonds to claim', () => {
        context('> and batch is cleared', () => {
          it('it should return bonds [ETH]', async () => {
            const oldBalance = await token.balanceOf(authorized)
            const amount = randomAmount()
            const receipt1 = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
            const batchId = getBuyOrderBatchId(receipt1)

            await progressToNextBatch()
            await curve.clearBatches()

            const receipt2 = await curve.claimBuy(authorized, ETH, batchId)
            const batch = await getBatch(ETH, batchId)
            const newbalance = await token.balanceOf(authorized)

            assertEvent(receipt2, 'ReturnBuy')
            assert.isAbove(batch.totalBuyReturn.toNumber(), 0)
            assert.isAbove(newbalance.toNumber(), oldBalance.toNumber())

            // TODO: add math checks
          })

          it('it should return bonds [ERC20]', async () => {
            // TODO
          })
        })
      })

      context('> but there are no tokens to claim', () => {
        context('> because address has no pending buy order at all', () => {
          it('it should revert [ETH]', async () => {
            const amount = randomAmount()
            const receipt1 = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
            const batchId = getBuyOrderBatchId(receipt1)

            await progressToNextBatch()
            await curve.clearBatches()

            await assertRevert(() => curve.claimBuy(authorized2, ETH, batchId))
          })

          it('it should revert [ERC20]', async () => {
            const receipt = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt)

            await progressToNextBatch()
            await curve.clearBatches()

            await assertRevert(() => curve.claimBuy(authorized2, token1.address, batchId))
          })
        })

        context('> because address has a pending buy order but created through another collateral token', () => {
          it('it should revert [ETH]', async () => {
            const amount = randomAmount()
            const receipt1 = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
            const batchId = getBuyOrderBatchId(receipt1)

            await progressToNextBatch()
            await curve.clearBatches()

            await assertRevert(() => curve.claimBuy(authorized, token1.address, batchId))
          })

          it('it should revert [ERC20]', async () => {
            const receipt = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt)

            await progressToNextBatch()
            await curve.clearBatches()

            await assertRevert(() => curve.claimBuy(authorized, token2.address, batchId))
          })
        })

        context('> because buy order has already been claimed', () => {
          it('it should revert [ETH]', async () => {
            const amount = randomAmount()
            const receipt1 = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
            const batchId = getBuyOrderBatchId(receipt1)

            await progressToNextBatch()
            await curve.clearBatches()
            await curve.claimBuy(authorized, ETH, batchId)

            await assertRevert(() => curve.claimBuy(authorized, ETH, batchId))
          })

          it('it should revert [ERC20]', async () => {
            const receipt1 = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
            const batchId = getBuyOrderBatchId(receipt1)

            await progressToNextBatch()
            await curve.clearBatches()
            await curve.claimBuy(authorized, token1.address, batchId)

            await assertRevert(() => curve.claimBuy(authorized, token1.address, batchId))
          })
        })
      })

      context('> but batch is not yet cleared', () => {
        it('it should revert [ETH]', async () => {
          const amount = randomAmount()
          const receipt = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })
          const batchId = getBuyOrderBatchId(receipt)

          await assertRevert(() => curve.claimBuy(authorized, ETH, batchId))
        })

        it('it should revert [ERC20]', async () => {
          const receipt = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
          const batchId = getBuyOrderBatchId(receipt)

          await assertRevert(() => curve.claimBuy(authorized, token1.address, batchId))
        })
      })
    })

    context('> but collateral is not whitelisted', () => {
      it('it should revert', async () => {
        const unlisted = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
        await unlisted.approve(curve.address, INITIAL_TOKEN_BALANCE, { from: authorized })

        const receipt = await curve.createBuyOrder(authorized, token1.address, randomAmount(), { from: authorized })
        const batchId = getBuyOrderBatchId(receipt)

        await progressToNextBatch()
        await curve.clearBatches()

        await assertRevert(() => curve.claimBuy(authorized, unlisted.address, batchId))
      })
    })
  })
  // #endregion

  // #region checkMath
  // context('#Checks math', () => {
  //   context('> Just one collateralToken being used', () => {
  //     let collateralTokenIndex, totalSupply, balance, reserveRatio, _token, collateralToken
  //     let tokens
  //     beforeEach(() => {
  //       collateralTokenIndex = Math.floor(Math.random() * VIRTUAL_SUPPLIES.length)
  //       totalSupply = new Decimal(VIRTUAL_SUPPLIES[collateralTokenIndex])
  //       balance = new Decimal(VIRTUAL_BALANCES[collateralTokenIndex])
  //       reserveRatio = (new Decimal(RESERVE_RATIOS[collateralTokenIndex])).div(PPM)
  //       tokens =  [ETH, token1, token2]
  //       _token = tokens[collateralTokenIndex]
  //       collateralToken = typeof _token.address === 'undefined' ? ETH : _token.address
  //       if (DEBUG) console.log({collateralTokenIndex})
  //     })
  //     context('> Just buys', () => {
  //       it('it should give the correct estimate for one buy', async () => {
  //         let amount = new Decimal(10)
  //         let expectedReturn = getBuy({
  //           amount,
  //           totalSupply,
  //           balance,
  //           reserveRatio
  //         })
  //         expectedReturn = new web3.BigNumber(expectedReturn.slope.toFixed(0))
  //         let estimatedReturn = await curve.getBuy(collateralToken, "0", "0", amount.toString(10))
  //         let marginOfError = getMarginOfError({totalSupply, balance})
  //         assert(expectedReturn.sub(estimatedReturn.toString(10)).abs().lt(marginOfError), `getBuy estimate was wrong ${expectedReturn.toString(10)} ${estimatedReturn.toString(10)} `)
  //       })
  //       it('it should match the estimate to the result for one buy', async () => {
  //         let amount = 10
  //         let estimatedReturn = await curve.getBuy(collateralToken, "0", "0", amount)
  //         await buyAndClaimTokens({
  //           address: authorized,
  //           collateralToken,
  //           amount
  //         })
  //         let balance = await token.balanceOf(authorized)
  //         assert(estimatedReturn.eq(balance), `Didn't buy as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} ${balance.toString(10)} ${estimatedReturn.toString(10)}`)
  //       })
  //       it('it should match the estimate to the result for two buys', async () => {
  //         let firstAmount = 10
  //         let secondAmount = 20
  //         let amount = firstAmount + secondAmount

  //         let estimatedTotalReturn = await curve.getBuy(collateralToken, "0", "0", amount)

  //         let firstPercentage = (new Decimal(firstAmount)).div(amount)
  //         let secondPercentage = (new Decimal(secondAmount)).div(amount)

  //         let estimatedFirstReturn = estimatedTotalReturn.mul(firstPercentage).toFixed(0)
  //         let estimatedSecondReturn = estimatedTotalReturn.sub(estimatedFirstReturn).toFixed(0)

  //         const firstOrderBatchId = await buyToken({
  //           address: authorized,
  //           collateralToken,
  //           amount: firstAmount
  //         })
  //         const secondOrderBatchId = await buyToken({
  //           address: authorized2,
  //           collateralToken,
  //           amount: secondAmount
  //         })
  //         assert(firstOrderBatchId === secondOrderBatchId, `Batche IDs didn't match ${firstOrderBatchId} ${secondOrderBatchId}`)

  //         await increaseBlocks(BLOCKS_IN_BATCH)
  //         await curve.clearBatches()

  //         const firstBuyClaim = await curve.claimBuy(authorized, collateralToken, firstOrderBatchId)
  //         const secondBuyClaim = await curve.claimBuy(authorized2, collateralToken, firstOrderBatchId)

  //         const marginOfError = getMarginOfError({balance, totalSupply})

  //         const firstBalance = await token.balanceOf(authorized)
  //         assert(firstBalance.sub(estimatedFirstReturn).abs().lt(marginOfError), `First estimate (${estimatedFirstReturn.toString(10)}) did not match actual balance (${firstBalance.toString(10)}) within margin of error ${marginOfError.toString(10)}`)
  //         const secondBalance = await token.balanceOf(authorized2)
  //         assert(secondBalance.sub(estimatedSecondReturn).abs().lt(marginOfError), `Second Estimate (${estimatedSecondReturn.toString(10)}) did not match actual balance (${secondBalance.toString(10)}) within margin of error ${marginOfError.toString(10)}`)
  //       })
  //     })
  //     context('> Just sells', () => {
  //       it('it should give the correct estimate for one sell', async () => {
  //         let balanceOf = await buyAndClaimTokens({
  //           address: authorized,
  //           collateralToken,
  //           amount: 100
  //         })

  //         let amount = new Decimal(balanceOf.div(2).toFixed(0))

  //         const actualTotalSupply = await token.totalSupply()
  //         const actualBalance = await controller.poolBalance(collateralToken)

  //         totalSupply = totalSupply.add(actualTotalSupply.toString(10))
  //         balance = balance.add(actualBalance.toString(10))

  //         let expectedReturn = getSell({
  //           amount,
  //           totalSupply,
  //           balance,
  //           reserveRatio
  //         })
  //         expectedReturn = new web3.BigNumber(expectedReturn.slope.toFixed(0))
  //         let estimatedReturn = await curve.getSell(collateralToken, actualTotalSupply, actualBalance, amount.toString(10))
  //         let marginOfError = getMarginOfError({totalSupply, balance})
  //         assert(expectedReturn.sub(estimatedReturn.toString(10)).abs().lt(marginOfError), `getSell estimate was wrong ${expectedReturn.toString(10)} ${estimatedReturn.toString(10)} `)
  //       })
  //       it('it should match the estimate to the result for one sell', async () => {
  //         let balanceOf = await buyAndClaimTokens({
  //           address: authorized,
  //           collateralToken,
  //           amount: 200
  //         })
  //         let amount = new Decimal(balanceOf.div(2).toFixed(0))

  //         let actualTotalSupply = await token.totalSupply()
  //         let actualBalance = await controller.poolBalance(collateralToken)

  //         let estimatedReturn = await curve.getSell(collateralToken, actualTotalSupply, actualBalance, amount.toString(10))

  //         // BEGIN COUNTING GAS
  //         let collateralBalanceBefore
  //         if (collateralToken === ETH) {
  //           collateralBalanceBefore = await getBalance(authorized)
  //         } else {
  //           collateralBalanceBefore = await _token.balanceOf(authorized)
  //         }
  //         const {firstApprove, secondApprove, sellReceipt} = await sellHalfAsMuchAsPossible({
  //           address: authorized,
  //           collateralToken
  //         })
  //         const sellGas = new web3.BigNumber(sellReceipt.receipt.gasUsed)
  //         const firstApproveGas = new web3.BigNumber(firstApprove.receipt.gasUsed)
  //         const secondApproveGas = new web3.BigNumber(secondApprove.receipt.gasUsed)

  //         let NewSellOrder = sellReceipt.logs.find(l => l.event === 'NewSellOrder')
  //         let sellBatchNumber = NewSellOrder ? NewSellOrder.args.batchId.toNumber() : new Error('No Buy Order')

  //         await increaseBlocks(BLOCKS_IN_BATCH)

  //         const clearBatchesReceipt = await curve.clearBatches({from: authorized})
  //         const clearBatchesGas = new web3.BigNumber(clearBatchesReceipt.receipt.gasUsed)

  //         const claimSellReceipt = await curve.claimSell(authorized, collateralToken, sellBatchNumber, {from: authorized})
  //         const claimSellGas = new web3.BigNumber(claimSellReceipt.receipt.gasUsed)

  //         let collateralBalanceAfter
  //         if (collateralToken === ETH) {
  //           let gasSpent = sellGas.add(clearBatchesGas).add(claimSellGas).add(firstApproveGas).add(secondApproveGas)
  //           let gasCost = new web3.BigNumber(15000000001)
  //           collateralBalanceAfter = await getBalance(authorized)
  //           collateralBalanceAfter = collateralBalanceAfter.add(gasSpent.mul(gasCost))
  //         } else {
  //           collateralBalanceAfter = await _token.balanceOf(authorized)
  //         }

  //         const netGain = collateralBalanceAfter.sub(collateralBalanceBefore)

  //         actualTotalSupply = await token.totalSupply()
  //         actualBalance = await controller.poolBalance(collateralToken)

  //         totalSupply = totalSupply.add(actualTotalSupply.toString(10))
  //         balance = balance.add(actualBalance.toString(10))

  //         const marginOfError = getMarginOfError({totalSupply, balance})
  //         assert(estimatedReturn.sub(netGain).abs().lt(marginOfError), `Didn't receive as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} ${netGain.toString(10)} ${estimatedReturn.toString(10)}`)
  //       })

  //       it('it should match the estimate to the result for two sells', async () => {
  //         let balanceOfOne = await buyAndClaimTokens({
  //           address: authorized,
  //           collateralToken,
  //           amount: 200
  //         })
  //         let firstAmount = new Decimal(balanceOfOne.div(2).toFixed(0))

  //         let balanceOfTwo = await buyAndClaimTokens({
  //           address: authorized2,
  //           collateralToken,
  //           amount: 500
  //         })
  //         let secondAmount = new Decimal(balanceOfTwo.div(2).toFixed(0))

  //         let amount = firstAmount.add(secondAmount)

  //         let actualTotalSupply = await token.totalSupply()
  //         let actualBalance = await controller.poolBalance(collateralToken)

  //         let estimatedTotalReturn = await curve.getSell(collateralToken, actualTotalSupply, actualBalance, amount.toString(10))

  //         let firstPercentage = (new Decimal(firstAmount)).div(amount)
  //         let secondPercentage = (new Decimal(secondAmount)).div(amount)

  //         let estimatedFirstReturn = new Decimal(estimatedTotalReturn.mul(firstPercentage).toFixed(0))
  //         let estimatedSecondReturn = new Decimal(estimatedTotalReturn.mul(secondPercentage).toFixed(0))

  //         await progressToNextBatch()

  //         // BEGIN COUNTING GAS

  //         // Seller 1
  //         let collateralBalanceBefore_1
  //         if (collateralToken === ETH) {
  //           collateralBalanceBefore_1 = await getBalance(authorized)
  //         } else {
  //           collateralBalanceBefore_1 = await _token.balanceOf(authorized)
  //         }

  //         // Seller 2
  //         let collateralBalanceBefore_2
  //         if (collateralToken === ETH) {
  //           collateralBalanceBefore_2 = await getBalance(authorized2)
  //         } else {
  //           collateralBalanceBefore_2 = await _token.balanceOf(authorized2)
  //         }

  //         // Seller 1

  //         let {firstApprove, secondApprove, sellReceipt} = await sellSomeAmount({
  //           address: authorized,
  //           collateralToken,
  //           amount: firstAmount.toString(10)
  //         })
  //         const firstApprove_1 = firstApprove
  //         const secondApprove_1 = secondApprove
  //         const sellReceipt_1 = sellReceipt

  //         const firstApproveGas_1 = new web3.BigNumber(firstApprove_1.receipt.gasUsed)
  //         const secondApproveGas_1 = new web3.BigNumber(secondApprove_1.receipt.gasUsed)
  //         const sellGas_1 = new web3.BigNumber(sellReceipt_1.receipt.gasUsed)

  //         let NewSellOrder_1 = sellReceipt_1.logs.find(l => l.event === 'NewSellOrder')
  //         let sellBatchNumber = NewSellOrder_1 ? NewSellOrder_1.args.batchId.toNumber() : new Error('No Buy Order')

  //         // Seller 2

  //         const {firstApprove_2, secondApprove_2, sellReceipt_2} = await (async () => {
  //           let {firstApprove, secondApprove, sellReceipt} = await sellSomeAmount({
  //             address: authorized2,
  //             collateralToken,
  //             amount: secondAmount.toString(10)
  //           })
  //           return {
  //             firstApprove_2: firstApprove,
  //             secondApprove_2: secondApprove,
  //             sellReceipt_2: sellReceipt
  //           }
  //         })()

  //         assert(firstApprove_1.tx !== firstApprove_2.tx, "txs shouldn't match (1)")
  //         assert(secondApprove_1.tx !== secondApprove_2.tx, "txs shouldn't match (2)")
  //         assert(sellReceipt_1.tx !== sellReceipt_2.tx, "txs shouldn't match (3)")

  //         const firstApproveGas_2 = new web3.BigNumber(firstApprove_2.receipt.gasUsed)
  //         const secondApproveGas_2 = new web3.BigNumber(secondApprove_2.receipt.gasUsed)
  //         const sellGas_2 = new web3.BigNumber(sellReceipt_2.receipt.gasUsed)

  //         let NewSellOrder_2 = sellReceipt_2.logs.find(l => l.event === 'NewSellOrder')
  //         let sellBatchNumber_2 = NewSellOrder_2 ? NewSellOrder_2.args.batchId.toNumber() : new Error('No Buy Order')

  //         assert(sellBatchNumber === sellBatchNumber_2, `Sell batches don't match ${sellBatchNumber} ${sellBatchNumber_2}`)

  //         // clear batches and count the money

  //         await increaseBlocks(BLOCKS_IN_BATCH)

  //         const clearBatchesReceipt = await curve.clearBatches({from: root})
  //         const claimSellReceipt_1 = await curve.claimSell(authorized, collateralToken, sellBatchNumber, {from: root})
  //         const claimSellReceipt_2 = await curve.claimSell(authorized2, collateralToken, sellBatchNumber, {from: root})

  //         // margin of error
  //         actualTotalSupply = await token.totalSupply()
  //         actualBalance = await controller.poolBalance(collateralToken)
  //         totalSupply = totalSupply.add(actualTotalSupply.toString(10))
  //         balance = balance.add(actualBalance.toString(10))
  //         const marginOfError = getMarginOfError({totalSupply, balance})

  //         // Seller 1
  //         let collateralBalanceAfter_1
  //         if (collateralToken === ETH) {
  //           let gasSpent_1 = sellGas_1.add(firstApproveGas_1).add(secondApproveGas_1)
  //           collateralBalanceAfter_1 = await getBalance(authorized)
  //           collateralBalanceAfter_1 = collateralBalanceAfter_1.add(gasSpent_1.mul(gasCost))
  //         } else {
  //           collateralBalanceAfter_1 = await _token.balanceOf(authorized)
  //         }
  //         const netGain_1 = collateralBalanceAfter_1.sub(collateralBalanceBefore_1)
  //         assert(estimatedFirstReturn.sub(netGain_1.toString(10)).abs().lt(marginOfError), `Didn't receive as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} for seller 1 ${netGain_1.toString(10)} ${estimatedFirstReturn.toString(10)}`)

  //         // Seller 2
  //         let collateralBalanceAfter_2
  //         if (collateralToken === ETH) {
  //           let gasSpent_2 = sellGas_2.add(firstApproveGas_2).add(secondApproveGas_2)
  //           collateralBalanceAfter_2 = await getBalance(authorized2)
  //           collateralBalanceAfter_2 = collateralBalanceAfter_2.add(gasSpent_2.mul(gasCost))
  //         } else {
  //           collateralBalanceAfter_2 = await _token.balanceOf(authorized2)
  //         }
  //         const netGain_2 = collateralBalanceAfter_2.sub(collateralBalanceBefore_2)
  //         assert(estimatedSecondReturn.sub(netGain_2.toString(10)).abs().lt(marginOfError), `Didn't receive as many tokens as predicted from collateralTokenIndex ${collateralTokenIndex} for seller 2 ${netGain_2.toString(10)} ${estimatedSecondReturn.toString(10)}`)
  //       })
  //     })
  //   })
  // })
  // #endregion
})

// function getMarginOfError({totalSupply, balance}) {
//   if (typeof totalSupply !== "Object") {
//     totalSupply = new Decimal(totalSupply)
//   }
//   if (typeof balance !== "Object") {
//     balance = new Decimal(balance)
//   }
//   let averageSquareRootLength = totalSupply.add(balance).div(2).sqrt().toFixed(0).toString(10).length
//   return (new Decimal(10)).pow(new Decimal(1).mul(averageSquareRootLength))
// }

function getSell({ totalSupply, balance, reserveRatio, amount }) {
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
  let m = balance.mul(n.add(1)).div(totalSupply.pow(n.add(1)))
  let s = totalSupply.sub(amount)
  let k = amount
  let slope = m
    .div(n.add(1))
    .mul(s.pow(n.add(1)))
    .mul(
      k
        .div(s)
        .add(1)
        .pow(n.add(1))
        .sub(1)
    )

  return { bancor, slope, m, n }
}

function getBuy({ totalSupply, balance, reserveRatio, amount }) {
  // // Straight from bancor contract
  // // Return = _supply * ((1 + _depositAmount / _connectorBalance) ^ (_connectorWeight / 1000000) - 1)
  // let bancorClassic = totalSupply.mul(
  //   (new Decimal(1)).add(
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
  const n = new Decimal(1).div(reserveRatio).sub(1)
  const m = balance.mul(n.add(1)).div(totalSupply.pow(n.add(1)))

  const slope = totalSupply.mul(
    amount
      .mul(n.add(1))
      .div(m.mul(totalSupply.pow(n.add(1))))
      .add(1)
      .pow(new Decimal(1).div(n.add(1)))
      .sub(1)
  )

  // bancor formula from white paper
  // buyAmt = tokenSupply * ((1 + amtPaid / collateral)^CW — 1)
  const bancor = totalSupply.mul(
    new Decimal(1)
      .plus(amount.div(balance))
      .pow(reserveRatio)
      .sub(1)
  )

  return { bancor, slope, m, n }
}
