/* eslint-disable no-undef */
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { hash } = require('eth-ens-namehash')
const sha3 = require('js-sha3').keccak_256
const coder = require('web3/lib/solidity/coder.js')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const TokenManager = artifacts.require('TokenManager')
const Vault = artifacts.require('Vault')
const Pool = artifacts.require('Pool')
const Tap = artifacts.require('Tap')
const Formula = artifacts.require('BancorFormula')
const MarketMaker = artifacts.require('BancorMarketMaker')
const Controller = artifacts.require('AragonFundraisingController')

const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')
const ForceSendETH = artifacts.require('ForceSendETH')

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}

const assertExternalEvent = (tx, eventName, instances = 1) => {
  const events = tx.receipt.logs.filter(l => {
    return l.topics[0] === '0x' + sha3(eventName)
  })
  assert.equal(events.length, instances, `'${eventName}' event should have been fired ${instances} times`)
  return events
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

const randomTap = () => {
  return Math.floor(Math.random() * 999) + 1
}

contract('AragonFundraisingController app', accounts => {
  let factory, dao, acl, tmBase, vBase, pBase, tBase, mmBase, cBase, token1
  let token, tokenManager, vault, pool, tap, formula, marketMaker, controller

  let ETH,
    APP_MANAGER_ROLE,
    TM_MINT_ROLE,
    TM_BURN_ROLE,
    POOL_ADD_COLLATERAL_TOKEN_ROLE,
    POOL_TRANSFER_ROLE,
    MM_ADD_COLLATERAL_TOKEN_ROLE,
    MM_CREATE_BUY_ORDER_ROLE,
    MM_CREATE_SELL_ORDER_ROLE,
    TAP_ADD_TOKEN_TAP_ROLE,
    TAP_UPDATE_TOKEN_TAP_ROLE,
    TAP_UPDATE_MONTHLY_TAP_INCREASE_ROLE,
    TAP_WITHDRAW_ROLE,
    CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE,
    CONTROLLER_UPDATE_TOKEN_TAP_ROLE,
    CONTROLLER_UPDATE_MONTHLY_TAP_INCREASE_ROLE,
    CONTROLLER_CREATE_BUY_ORDER_ROLE,
    CONTROLLER_CREATE_SELL_ORDER_ROLE,
    CONTROLLER_WITHDRAW_ROLE

  const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
  const VAULT_ID = hash('vault.aragonpm.eth')
  const POOL_ID = hash('pool.aragonpm.eth')
  const TAP_ID = hash('tap.aragonpm.eth')
  const MARKET_MAKER_ID = hash('bancor-market-maker.aragonpm.eth')
  const FUNDRAISING_CONTROLLER_ID = hash('fundraising-controller.aragonpm.eth')

  const INITIAL_ETH_BALANCE = 500
  const INITIAL_TOKEN_BALANCE = 1000
  const MAX_MONTHLY_TAP_INCREASE_RATE = 50 * Math.pow(10, 16)

  const BLOCKS_IN_BATCH = 10
  const FEE_PERCENT = 10000

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
    const mmReceipt = await dao.newAppInstance(MARKET_MAKER_ID, mmBase.address, '0x', false)
    marketMaker = await MarketMaker.at(getEvent(mmReceipt, 'NewAppProxy', 'proxy'))
    // aragon fundraising controller
    const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
    controller = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(marketMaker.address, tokenManager.address, TM_MINT_ROLE, root, { from: root })
    await acl.createPermission(marketMaker.address, tokenManager.address, TM_BURN_ROLE, root, { from: root })
    await acl.createPermission(marketMaker.address, pool.address, POOL_TRANSFER_ROLE, root, { from: root })
    await acl.grantPermission(tap.address, pool.address, POOL_TRANSFER_ROLE, { from: root })
    await acl.createPermission(controller.address, pool.address, POOL_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_ADD_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_UPDATE_MONTHLY_TAP_INCREASE_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_WITHDRAW_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_CREATE_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_CREATE_SELL_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_MONTHLY_TAP_INCREASE_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_CREATE_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_CREATE_SELL_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_WITHDRAW_ROLE, root, { from: root })
    // collaterals
    token1 = await TokenMock.new(authorized, INITIAL_TOKEN_BALANCE)
    // allowances
    await token1.approve(marketMaker.address, INITIAL_TOKEN_BALANCE, { from: authorized })
    // initializations
    await token.changeController(tokenManager.address)
    await tokenManager.initialize(token.address, true, 0)
    await vault.initialize()
    await pool.initialize()
    await tap.initialize(pool.address, vault.address, MAX_MONTHLY_TAP_INCREASE_RATE)
    await controller.initialize(marketMaker.address, pool.address, tap.address)
    await marketMaker.initialize(controller.address, tokenManager.address, pool.address, vault.address, formula.address, BLOCKS_IN_BATCH, FEE_PERCENT)
    // make sure tests start at the beginning of a new batch
    await progressToNextBatch()
  }

  const randomAmount = () => {
    return new web3.BigNumber(Math.floor(Math.random() * Math.floor(INITIAL_TOKEN_BALANCE / 3)) + 1)
  }

  const getBuyOrderBatchId = tx => {
    const events = tx.receipt.logs.filter(l => {
      return l.topics[0] === '0x' + sha3('NewBuyOrder(address,address,uint256,uint256)')
    })
    const data = coder.decodeParams(['uint256', 'uint256'], events[0].data.replace('0x', ''))

    return data[1]
  }

  const getSellOrderBatchId = tx => {
    const events = tx.receipt.logs.filter(l => {
      return l.topics[0] === '0x' + sha3('NewSellOrder(address,address,uint256,uint256)')
    })
    const data = coder.decodeParams(['uint256', 'uint256'], events[0].data.replace('0x', ''))

    return data[1]
  }

  const createAndClaimBuyOrder = async ({ address, collateralToken, amount, from }) => {
    from = from || address
    // create buy order
    const receipt = await controller.createBuyOrder(collateralToken, amount, { from, value: collateralToken === ETH ? amount : 0 })
    const batchId = getBuyOrderBatchId(receipt)
    // move to next batch
    await progressToNextBatch()
    // clear batch
    await controller.clearBatches()
    // claim bonds
    await controller.claimBuy(collateralToken, batchId, { from: address })
    // return balance
    const balance = await token.balanceOf(address)

    return balance
  }

  const progressToNextBatch = async () => {
    let currentBlock = await blockNumber()
    let currentBatch = await marketMaker.getCurrentBatchId()
    let blocksTilNextBatch = currentBatch.add(BLOCKS_IN_BATCH).sub(currentBlock)
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
    mmBase = await MarketMaker.new()
    cBase = await Controller.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TM_MINT_ROLE = await tmBase.MINT_ROLE()
    TM_BURN_ROLE = await tmBase.BURN_ROLE()
    POOL_ADD_COLLATERAL_TOKEN_ROLE = await pBase.ADD_COLLATERAL_TOKEN_ROLE()
    POOL_TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
    TAP_ADD_TOKEN_TAP_ROLE = await tBase.ADD_TOKEN_TAP_ROLE()
    TAP_UPDATE_TOKEN_TAP_ROLE = await tBase.UPDATE_TOKEN_TAP_ROLE()
    TAP_UPDATE_MONTHLY_TAP_INCREASE_ROLE = await tBase.UPDATE_MONTHLY_TAP_INCREASE_ROLE()
    TAP_WITHDRAW_ROLE = await tBase.WITHDRAW_ROLE()
    MM_ADD_COLLATERAL_TOKEN_ROLE = await mmBase.ADD_COLLATERAL_TOKEN_ROLE()
    MM_CREATE_BUY_ORDER_ROLE = await mmBase.CREATE_BUY_ORDER_ROLE()
    MM_CREATE_SELL_ORDER_ROLE = await mmBase.CREATE_SELL_ORDER_ROLE()
    CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE = await cBase.ADD_COLLATERAL_TOKEN_ROLE()
    CONTROLLER_UPDATE_TOKEN_TAP_ROLE = await cBase.UPDATE_TOKEN_TAP_ROLE()
    CONTROLLER_UPDATE_MONTHLY_TAP_INCREASE_ROLE = await cBase.UPDATE_MONTHLY_TAP_INCREASE_ROLE()
    CONTROLLER_CREATE_BUY_ORDER_ROLE = await cBase.CREATE_BUY_ORDER_ROLE()
    CONTROLLER_CREATE_SELL_ORDER_ROLE = await cBase.CREATE_SELL_ORDER_ROLE()
    CONTROLLER_WITHDRAW_ROLE = await cBase.WITHDRAW_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  // #region initialize
  context('> #initialize', () => {
    context('> initialization parameters are correct', () => {
      it('it should initialize aragon fundraising controller', async () => {
        assert.equal(await controller.marketMaker(), marketMaker.address)
        assert.equal(await controller.reserve(), pool.address)
        assert.equal(await controller.tap(), tap.address)
      })
    })

    context('> initialization parameters are not correct', () => {
      it('it should revert [market maker is not a contract]', async () => {
        const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
        const uninitialized = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))

        await assertRevert(() => uninitialized.initialize(authorized, pool.address, tap.address, { from: root }))
      })

      it('it should revert [reserve is not a contract]', async () => {
        const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
        const uninitialized = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))

        await assertRevert(() => uninitialized.initialize(marketMaker.address, authorized, tap.address, { from: root }))
      })

      it('it should revert [tap is not a contract]', async () => {
        const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
        const uninitialized = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))

        await assertRevert(() => uninitialized.initialize(marketMaker.address, pool.address, authorized, { from: root }))
      })
    })

    it('it should revert on re-initialization', async () => {
      await assertRevert(() => controller.initialize(marketMaker.address, pool.address, tap.address, { from: root }))
    })
  })
  // #endregion

  // #region addCollateralToken
  context('> #addCollateralToken', () => {
    context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should add collateral token', async () => {
        const receipt = await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })

        assertExternalEvent(receipt, 'AddTokenTap(address,uint256)') // tap
        assertExternalEvent(receipt, 'AddCollateralToken(address)') // pool
        assertExternalEvent(receipt, 'AddCollateralToken(address,uint256,uint256,uint32)') // market maker
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
            from: unauthorized,
          })
        )
      })
    })
  })
  // #endregion

  // #region updateMaxMonthlyTapIncreaseRate
  context('> #updateMaxMonthlyTapIncreaseRate', () => {
    context('> sender has UPDATE_MONTHLY_TAP_INCREASE_ROLE', () => {
      it('it should update maximum monthly tap increase rate', async () => {
        const receipt = await controller.updateMaxMonthlyTapIncreaseRate(70 * Math.pow(10, 16), { from: authorized })

        assertExternalEvent(receipt, 'UpdateMaxMonthlyTapIncreaseRate(uint256)') // tap
      })
    })

    context('> sender does not have UPDATE_MONTHLY_TAP_INCREASE_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => controller.updateMaxMonthlyTapIncreaseRate(70 * Math.pow(10, 16), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateTokenTap
  context('> #updateTokenTap', () => {
    context('> sender has UPDATE_TOKEN_TAP_ROLE', () => {
      it('it should update token tap', async () => {
        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), 10, { from: authorized })
        await timeTravel(2592000) // 1 month = 2592000 seconds

        const receipt = await controller.updateTokenTap(token1.address, 14, { from: authorized })

        assertExternalEvent(receipt, 'UpdateTokenTap(address,uint256)') // tap
      })
    })

    context('> sender does not have UPDATE_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), 10, { from: authorized })
        await timeTravel(2592000) // 1 month = 2592000 seconds

        await assertRevert(() => controller.updateTokenTap(token1.address, 14, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region withdraw
  context('> #withdraw', () => {
    context('> sender has WITHDRAW_ROLE', () => {
      it('it should transfer funds from the reserve to the beneficiary [ETH]', async () => {
        await forceSendETH(pool.address, INITIAL_ETH_BALANCE)

        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })
        await timeTravel(2592000)

        const receipt = await controller.withdraw(ETH, { from: authorized })

        assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
      })

      it('it should transfer funds from the reserve to the beneficiary [ERC20]', async () => {
        await token1.transfer(pool.address, INITIAL_TOKEN_BALANCE / 2, { from: authorized })

        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })
        await timeTravel(2592000)

        const receipt = await controller.withdraw(token1.address, { from: authorized })

        assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
      })
    })

    context('> sender does not have WITHDRAW_ROLE', () => {
      it('it should revert [ETH]', async () => {
        await forceSendETH(pool.address, INITIAL_ETH_BALANCE)

        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })
        await timeTravel(2592000)

        await assertRevert(() => controller.withdraw(ETH, { from: unauthorized }))
      })

      it('it should revert [ERC20]', async () => {
        await token1.transfer(pool.address, INITIAL_TOKEN_BALANCE / 2, { from: authorized })

        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })
        await timeTravel(2592000)

        await assertRevert(() => controller.withdraw(token1.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region createBuyOrder
  context('> #createBuyOrder', () => {
    context('> sender has CREATE_BUY_ORDER_ROLE', () => {
      it('it should create buy order [ETH]', async () => {
        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })

        const amount = randomAmount()
        const receipt = await controller.createBuyOrder(ETH, amount, { from: authorized, value: amount })

        assertExternalEvent(receipt, 'NewBuyOrder(address,address,uint256,uint256)') // market maker
      })

      it('it should create buy order [ERC20]', async () => {
        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })

        const receipt = await controller.createBuyOrder(token1.address, randomAmount(), { from: authorized })

        assertExternalEvent(receipt, 'NewBuyOrder(address,address,uint256,uint256)') // market maker
      })
    })

    context('> sender does not have CREATE_BUY_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })
        const amount = randomAmount()

        await assertRevert(() => controller.createBuyOrder(ETH, amount, { from: unauthorized, value: amount }))
      })

      it('it should revert [ERC20]', async () => {
        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })

        await assertRevert(() => controller.createBuyOrder(token1.address, randomAmount(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region createSellOrder
  context('> #createSellOrder', () => {
    context('> sender has CREATE_SELL_ORDER_ROLE', () => {
      it('it should create sell order [ETH]', async () => {
        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })

        const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })
        const receipt = await controller.createSellOrder(ETH, balance, { from: authorized })

        assertExternalEvent(receipt, 'NewSellOrder(address,address,uint256,uint256)') // market maker
      })

      it('it should create sell order [ERC20]', async () => {
        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })

        const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })
        const receipt = await controller.createSellOrder(token1.address, balance, { from: authorized })

        assertExternalEvent(receipt, 'NewSellOrder(address,address,uint256,uint256)') // market maker
      })
    })

    context('> sender does not have CREATE_SELL_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })

        const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })

        await assertRevert(() => controller.createSellOrder(ETH, balance, { from: unauthorized }))
      })

      it('it should revert [ERC20]', async () => {
        await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
          from: authorized,
        })

        const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

        await assertRevert(() => controller.createSellOrder(token1.address, balance, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region clearBatches
  context('> #clearBatches', () => {
    it('it should clear batches [ETH]', async () => {
      await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })

      const amount = randomAmount()
      await controller.createBuyOrder(ETH, amount, { from: authorized, value: amount })

      await progressToNextBatch()

      const receipt = await controller.clearBatches()

      assertExternalEvent(receipt, 'ClearBatch(address,uint256)') // market maker
    })

    it('it should clear batches [ERC20]', async () => {
      await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
        from: authorized,
      })

      await controller.createBuyOrder(token1.address, randomAmount(), { from: authorized })

      await progressToNextBatch()

      const receipt = await controller.clearBatches()

      assertExternalEvent(receipt, 'ClearBatch(address,uint256)') // market maker
    })
  })
  // #endregion

  // #region claimBuy
  context('> #claimBuy', () => {
    it('it should return bonds [ETH]', async () => {
      await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })

      const amount = randomAmount()
      const receipt1 = await controller.createBuyOrder(ETH, amount, { from: authorized, value: amount })
      const batchId = getBuyOrderBatchId(receipt1)

      await progressToNextBatch()
      await controller.clearBatches()

      const receipt2 = await controller.claimBuy(ETH, batchId, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnBuy(address,address,uint256)') // market maker
    })

    it('it should return bonds [ERC20]', async () => {
      await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
        from: authorized,
      })

      const receipt1 = await controller.createBuyOrder(token1.address, randomAmount(), { from: authorized })
      const batchId = getBuyOrderBatchId(receipt1)

      await progressToNextBatch()
      await controller.clearBatches()

      const receipt2 = await controller.claimBuy(token1.address, batchId, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnBuy(address,address,uint256)') // market maker
    })
  })
  // #endregion

  // #region claimSell
  context('> #claimSell', () => {
    it('it should return collateral [ETH]', async () => {
      await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), { from: authorized })
      const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: ETH, amount: randomAmount() })

      const receipt1 = await controller.createSellOrder(ETH, balance, { from: authorized })
      const batchId = getSellOrderBatchId(receipt1)

      await progressToNextBatch()
      await controller.clearBatches()

      const receipt2 = await controller.claimSell(ETH, batchId, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnSell(address,address,uint256)') // market maker
    })

    it('it should return collateral [ERC20]', async () => {
      await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomTap(), {
        from: authorized,
      })
      const balance = await createAndClaimBuyOrder({ address: authorized, collateralToken: token1.address, amount: randomAmount() })

      const receipt1 = await controller.createSellOrder(token1.address, balance, { from: authorized })
      const batchId = getSellOrderBatchId(receipt1)

      await progressToNextBatch()
      await controller.clearBatches()

      const receipt2 = await controller.claimSell(token1.address, batchId, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnSell(address,address,uint256)') // market maker
    })
  })
  // #endregion

  // #region balanceOf
  context('> #balanceOf', () => {
    context('> reserve', () => {
      it('it should return available reserve balance [ETH]', async () => {
        await forceSendETH(pool.address, INITIAL_ETH_BALANCE)

        await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), 10, { from: authorized })
        await timeTravel(10)

        assert.isAtMost((await controller.balanceOf(pool.address, ETH)).toNumber(), INITIAL_ETH_BALANCE - 10 * 10)
      })

      it('it should return available pool balance [ERC20]', async () => {
        const collateral = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)

        await controller.addCollateralToken(collateral.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), 20, { from: authorized })
        await timeTravel(10)

        assert.isAtMost((await controller.balanceOf(pool.address, collateral.address)).toNumber(), INITIAL_TOKEN_BALANCE - 20 * 10)
      })
    })
    context('> other', () => {
      it('it should return balance [ETH]', async () => {
        assert.equal((await controller.balanceOf(authorized, ETH)).toNumber(), (await web3.eth.getBalance(authorized)).toNumber())
      })

      it('it should return balance [ETH]', async () => {
        assert.equal((await controller.balanceOf(authorized, token1.address)).toNumber(), (await token1.balanceOf(authorized)).toNumber())
      })
    })
  })
  // #endregion
})
