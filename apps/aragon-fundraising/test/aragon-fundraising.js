/* eslint-disable no-undef */
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { hash } = require('eth-ens-namehash')
const sha3 = require('js-sha3').keccak_256
const AllEvents = require('web3/lib/web3/allevents')

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const MiniMeToken = artifacts.require('MiniMeToken')
const TokenManager = artifacts.require('TokenManager')
const Vault = artifacts.require('Vault')
const Agent = artifacts.require('Agent')
const Tap = artifacts.require('Tap')
const Formula = artifacts.require('BancorFormula')
const MarketMaker = artifacts.require('BatchedBancorMarketMaker')
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

const randomSlippage = () => {
  return Math.floor(Math.random() * 1000000000000000000) + 1
}

const randomTap = () => {
  return Math.floor(Math.random() * 999) + 1
}

const randomFloor = () => {
  return Math.floor(Math.random() * 999999) + 1
}

contract('AragonFundraisingController app', accounts => {
  let factory, dao, acl, tmBase, vBase, pBase, tBase, mmBase, cBase, token1
  let token, tokenManager, vault, pool, tap, formula, marketMaker, controller

  let ETH,
    APP_MANAGER_ROLE,
    TM_MINT_ROLE,
    TM_BURN_ROLE,
    POOL_ADD_PROTECTED_TOKEN_ROLE,
    // POOL_REMOVE_PROTECTED_TOKEN_ROLE,
    POOL_TRANSFER_ROLE,
    MM_UPDATE_FEES_ROLE,
    MM_UPDATE_BENEFICIARY_ROLE,
    MM_ADD_COLLATERAL_TOKEN_ROLE,
    MM_REMOVE_COLLATERAL_TOKEN_ROLE,
    MM_UPDATE_COLLATERAL_TOKEN_ROLE,
    MM_OPEN_BUY_ORDER_ROLE,
    MM_OPEN_SELL_ORDER_ROLE,
    TAP_UPDATE_BENEFICIARY_ROLE,
    TAP_ADD_TAPPED_TOKEN_ROLE,
    // TAP_REMOVE_TAPPED_TOKEN_ROLE,
    TAP_UPDATE_TAPPED_TOKEN_ROLE,
    TAP_UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE,
    TAP_WITHDRAW_ROLE,
    CONTROLLER_UPDATE_BENEFICIARY_ROLE,
    CONTROLLER_UPDATE_FEES_ROLE,
    CONTROLLER_UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE,
    CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE,
    CONTROLLER_REMOVE_COLLATERAL_TOKEN_ROLE,
    CONTROLLER_UPDATE_COLLATERAL_TOKEN_ROLE,
    CONTROLLER_UPDATE_TOKEN_TAP_ROLE,
    CONTROLLER_OPEN_BUY_ORDER_ROLE,
    CONTROLLER_OPEN_SELL_ORDER_ROLE,
    CONTROLLER_WITHDRAW_ROLE

  const TOKEN_MANAGER_ID = hash('token-manager.aragonpm.eth')
  const VAULT_ID = hash('vault.aragonpm.eth')
  const POOL_ID = hash('pool.aragonpm.eth')
  const TAP_ID = hash('tap.aragonpm.eth')
  const MARKET_MAKER_ID = hash('bancor-market-maker.aragonpm.eth')
  const FUNDRAISING_CONTROLLER_ID = hash('fundraising-controller.aragonpm.eth')

  const PPM = 1000000

  const INITIAL_ETH_BALANCE = 500
  const INITIAL_TOKEN_BALANCE = 1000
  const MAXIMUM_TAP_INCREASE_PCT = 50 * Math.pow(10, 16)

  const BLOCKS_IN_BATCH = 10
  const BUY_FEE_PERCENT = 100000000000000000 // 1%
  const SELL_FEE_PERCENT = 100000000000000000

  const VIRTUAL_SUPPLIES = [10 * Math.pow(10, 18), 100 * Math.pow(10, 18)]
  const VIRTUAL_BALANCES = [1 * Math.pow(10, 18), 1 * Math.pow(10, 18)]
  const RESERVE_RATIOS = [(PPM * 10) / 100, (PPM * 1) / 100]

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
    pool = await Agent.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
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
    await acl.createPermission(controller.address, pool.address, POOL_ADD_PROTECTED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_ADD_TAPPED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_UPDATE_TAPPED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE, root, { from: root })
    await acl.createPermission(controller.address, tap.address, TAP_WITHDRAW_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_UPDATE_FEES_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_REMOVE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_UPDATE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_OPEN_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(controller.address, marketMaker.address, MM_OPEN_SELL_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_FEES_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_REMOVE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_COLLATERAL_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_OPEN_BUY_ORDER_ROLE, root, { from: root })
    await acl.createPermission(authorized, controller.address, CONTROLLER_OPEN_SELL_ORDER_ROLE, root, { from: root })
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
    await tap.initialize(controller.address, pool.address, vault.address, BLOCKS_IN_BATCH, MAXIMUM_TAP_INCREASE_PCT)
    await controller.initialize(marketMaker.address, pool.address, tap.address)
    await marketMaker.initialize(
      controller.address,
      tokenManager.address,
      pool.address,
      vault.address,
      formula.address,
      BLOCKS_IN_BATCH,
      BUY_FEE_PERCENT,
      SELL_FEE_PERCENT
    )
    // make sure tests start at the beginning of a new batch
    await progressToNextBatch()
  }

  const randomAmount = () => {
    return new web3.BigNumber(Math.floor(Math.random() * Math.floor(INITIAL_TOKEN_BALANCE / 3)) + 1)
  }

  const decodeEventsForContract = (contract, receipt) => {
    const ae = new AllEvents(contract._web3, contract.abi, contract.address)

    // ae.decode mutates the args, so we deep copy
    return JSON.parse(JSON.stringify(receipt))
      .logs.filter(l => l.address === contract.address)
      .map(l => ae.decode(l))
  }

  const getBuyOrderBatchId = tx => {
    const events = decodeEventsForContract(marketMaker, tx.receipt)
    const event = events.filter(l => {
      return l.event === 'NewBuyOrder'
    })[0]

    return event.args.batchId
  }

  const getSellOrderBatchId = tx => {
    const events = decodeEventsForContract(marketMaker, tx.receipt)
    const event = events.filter(l => {
      return l.event === 'NewSellOrder'
    })[0]

    return event.args.batchId
  }

  const openAndClaimBuyOrder = async (collateral, amount, { from } = {}) => {
    // create buy order
    const receipt = await controller.openBuyOrder(collateral, amount, { from, value: collateral === ETH ? amount : 0 })
    const batchId = getBuyOrderBatchId(receipt)
    // move to next batch
    await progressToNextBatch()
    // claim bonds
    await controller.claimBuyOrder(batchId, collateral, { from })
    // return balance
    const balance = await token.balanceOf(from)

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

  const addCollateralToken = async (token, { virtualSupply, virtualBalance, reserveRatio, slippage, tap, floor } = {}) => {
    virtualSupply = virtualSupply || randomVirtualSupply()
    virtualBalance = virtualBalance || randomVirtualBalance()
    reserveRatio = reserveRatio || randomReserveRatio()
    slippage = slippage || randomSlippage()
    tap = tap || randomTap()
    floor = typeof floor !== 'undefined' ? floor : randomFloor()

    return controller.addCollateralToken(token, virtualSupply, virtualBalance, reserveRatio, slippage, tap, floor, { from: authorized })
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
    pBase = await Agent.new()
    tBase = await Tap.new()
    formula = await Formula.new()
    mmBase = await MarketMaker.new()
    cBase = await Controller.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TM_MINT_ROLE = await tmBase.MINT_ROLE()
    TM_BURN_ROLE = await tmBase.BURN_ROLE()
    POOL_ADD_PROTECTED_TOKEN_ROLE = await pBase.ADD_PROTECTED_TOKEN_ROLE()
    POOL_REMOVE_PROTECTED_TOKEN_ROLE = await pBase.REMOVE_PROTECTED_TOKEN_ROLE()
    POOL_TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
    TAP_UPDATE_BENEFICIARY_ROLE = await tBase.UPDATE_BENEFICIARY_ROLE()
    TAP_ADD_TAPPED_TOKEN_ROLE = await tBase.ADD_TAPPED_TOKEN_ROLE()
    TAP_REMOVE_TAPPED_TOKEN_ROLE = await tBase.REMOVE_TAPPED_TOKEN_ROLE()
    TAP_UPDATE_TAPPED_TOKEN_ROLE = await tBase.UPDATE_TAPPED_TOKEN_ROLE()
    TAP_UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE = await tBase.UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE()
    TAP_WITHDRAW_ROLE = await tBase.WITHDRAW_ROLE()
    MM_UPDATE_FEES_ROLE = await mmBase.UPDATE_FEES_ROLE()
    MM_UPDATE_BENEFICIARY_ROLE = await mmBase.UPDATE_BENEFICIARY_ROLE()
    MM_ADD_COLLATERAL_TOKEN_ROLE = await mmBase.ADD_COLLATERAL_TOKEN_ROLE()
    MM_REMOVE_COLLATERAL_TOKEN_ROLE = await mmBase.REMOVE_COLLATERAL_TOKEN_ROLE()
    MM_UPDATE_COLLATERAL_TOKEN_ROLE = await mmBase.UPDATE_COLLATERAL_TOKEN_ROLE()
    MM_OPEN_BUY_ORDER_ROLE = await mmBase.OPEN_BUY_ORDER_ROLE()
    MM_OPEN_SELL_ORDER_ROLE = await mmBase.OPEN_SELL_ORDER_ROLE()
    CONTROLLER_UPDATE_BENEFICIARY_ROLE = await cBase.UPDATE_BENEFICIARY_ROLE()
    CONTROLLER_UPDATE_FEES_ROLE = await cBase.UPDATE_FEES_ROLE()
    CONTROLLER_UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE = await cBase.UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE()
    CONTROLLER_ADD_COLLATERAL_TOKEN_ROLE = await cBase.ADD_COLLATERAL_TOKEN_ROLE()
    CONTROLLER_REMOVE_COLLATERAL_TOKEN_ROLE = await cBase.REMOVE_COLLATERAL_TOKEN_ROLE()
    CONTROLLER_UPDATE_COLLATERAL_TOKEN_ROLE = await cBase.UPDATE_COLLATERAL_TOKEN_ROLE()
    CONTROLLER_UPDATE_TOKEN_TAP_ROLE = await cBase.UPDATE_TOKEN_TAP_ROLE()
    CONTROLLER_OPEN_BUY_ORDER_ROLE = await cBase.OPEN_BUY_ORDER_ROLE()
    CONTROLLER_OPEN_SELL_ORDER_ROLE = await cBase.OPEN_SELL_ORDER_ROLE()
    CONTROLLER_WITHDRAW_ROLE = await cBase.WITHDRAW_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  // #region initialize
  context('> #initialize', () => {
    context('> initialization parameters are valid', () => {
      it('it should initialize controller', async () => {
        assert.equal(await controller.marketMaker(), marketMaker.address)
        assert.equal(await controller.reserve(), pool.address)
        assert.equal(await controller.tap(), tap.address)
      })
    })

    context('> initialization parameters are not valid', () => {
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

  // #region updateBeneficiary
  context('> #updateBeneficiary', () => {
    context('> sender has UPDATE_BENEFICIARY_ROLE', () => {
      it('it should update beneficiary', async () => {
        const receipt = await controller.updateBeneficiary(root, { from: authorized })

        assertExternalEvent(receipt, 'UpdateBeneficiary(address)', 2)
        assert.equal(await marketMaker.beneficiary(), root)
        assert.equal(await tap.beneficiary(), root)
      })
    })

    context('> sender does not have UPDATE_BENEFICIARY_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => controller.updateBeneficiary(root, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateFees
  context('> #updateFees', () => {
    context('> sender has UPDATE_FEES_ROLE', () => {
      it('it should update fees', async () => {
        const receipt = await controller.updateFees(5, 7, { from: authorized })

        assertExternalEvent(receipt, 'UpdateFees(uint256,uint256)')
        assert.equal((await marketMaker.buyFeePct()).toNumber(), 5)
        assert.equal((await marketMaker.sellFeePct()).toNumber(), 7)
      })
    })

    context('> sender does not have UPDATE_FEES_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => controller.updateFees(5, 7, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateMaximumTapIncreasePct
  context('> #updateMaximumTapIncreasePct', () => {
    context('> sender has UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE', () => {
      it('it should update maximum tap increase percentage', async () => {
        const receipt = await controller.updateMaximumTapIncreasePct(70 * Math.pow(10, 16), { from: authorized })

        assertExternalEvent(receipt, 'UpdateMaximumTapIncreasePct(uint256)') // tap
      })
    })

    context('> sender does not have UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => controller.updateMaximumTapIncreasePct(70 * Math.pow(10, 16), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region addCollateralToken
  context('> #addCollateralToken', () => {
    context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should add collateral token', async () => {
        const receipt1 = await controller.addCollateralToken(
          token1.address,
          randomVirtualSupply(),
          randomVirtualBalance(),
          randomReserveRatio(),
          randomSlippage(),
          randomTap(),
          randomFloor(),
          {
            from: authorized,
          }
        )

        const receipt2 = await controller.addCollateralToken(
          ETH,
          randomVirtualSupply(),
          randomVirtualBalance(),
          randomReserveRatio(),
          randomSlippage(),
          randomTap(),
          randomFloor(),
          {
            from: authorized,
          }
        )

        assertExternalEvent(receipt1, 'AddCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
        assertExternalEvent(receipt1, 'AddTappedToken(address,uint256,uint256)') // tap
        assertExternalEvent(receipt1, 'AddProtectedToken(address)') // pool

        assertExternalEvent(receipt2, 'AddCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
        assertExternalEvent(receipt2, 'AddTappedToken(address,uint256,uint256)') // tap
        assertExternalEvent(receipt2, 'AddProtectedToken(address)', 0) // ETH should not be added as a protected token into the pool
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          controller.addCollateralToken(
            token1.address,
            randomVirtualSupply(),
            randomVirtualBalance(),
            randomReserveRatio(),
            randomSlippage(),
            randomTap(),
            randomFloor(),
            {
              from: unauthorized,
            }
          )
        )
      })
    })
  })
  // #endregion

  // #region removeCollateralToken
  context('> #removeCollateralToken', () => {
    beforeEach(async () => {
      await controller.addCollateralToken(
        token1.address,
        randomVirtualSupply(),
        randomVirtualBalance(),
        randomReserveRatio(),
        randomSlippage(),
        randomTap(),
        randomFloor(),
        {
          from: authorized,
        }
      )

      await controller.addCollateralToken(
        ETH,
        randomVirtualSupply(),
        randomVirtualBalance(),
        randomReserveRatio(),
        randomSlippage(),
        randomTap(),
        randomFloor(),
        {
          from: authorized,
        }
      )
    })

    context('> sender has REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should remove collateral token', async () => {
        const receipt1 = await controller.removeCollateralToken(token1.address, { from: authorized })
        const receipt2 = await controller.removeCollateralToken(ETH, { from: authorized })

        assertExternalEvent(receipt1, 'RemoveCollateralToken(address)') // market maker
        assertExternalEvent(receipt2, 'RemoveCollateralToken(address)') // market maker
      })
    })

    context('> sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        controller.removeCollateralToken(token1.address, { from: authorized })
      })
    })
  })
  // #endregion

  // #region updateCollateralToken
  context('> #updateCollateralToken', () => {
    context('> sender has UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      beforeEach(async () => {
        await controller.addCollateralToken(
          token1.address,
          randomVirtualSupply(),
          randomVirtualBalance(),
          randomReserveRatio(),
          randomSlippage(),
          randomTap(),
          randomFloor(),
          {
            from: authorized,
          }
        )
      })

      it('it should update collateral token', async () => {
        const receipt = await controller.updateCollateralToken(
          token1.address,
          randomVirtualSupply(),
          randomVirtualBalance(),
          randomReserveRatio(),
          randomSlippage(),
          { from: authorized }
        )

        assertExternalEvent(receipt, 'UpdateCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
      })
    })

    context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => controller.updateTokenTap(token1.address, randomTap(), randomFloor(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateTokenTap
  context('> #updateTokenTap', () => {
    context('> sender has UPDATE_TOKEN_TAP_ROLE', () => {
      beforeEach(async () => {
        await controller.addCollateralToken(
          token1.address,
          randomVirtualSupply(),
          randomVirtualBalance(),
          randomReserveRatio(),
          randomSlippage(),
          10,
          randomFloor(),
          {
            from: authorized,
          }
        )

        await timeTravel(2592001) // 1 month = 2592000 seconds
      })

      it('it should update token tap', async () => {
        const receipt = await controller.updateTokenTap(token1.address, 14, randomFloor(), { from: authorized })

        assertExternalEvent(receipt, 'UpdateTappedToken(address,uint256,uint256)') // tap
      })
    })

    context('> sender does not have UPDATE_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => controller.updateTokenTap(token1.address, randomTap(), randomFloor(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region withdraw
  context('> #withdraw', () => {
    beforeEach(async () => {
      await forceSendETH(pool.address, INITIAL_ETH_BALANCE)
      await token1.transfer(pool.address, INITIAL_TOKEN_BALANCE, { from: authorized })

      await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), 10, 0, {
        from: authorized,
      })

      await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), 10, 0, {
        from: authorized,
      })

      await increaseBlocks(1000)
    })

    context('> sender has WITHDRAW_ROLE', () => {
      it('it should transfer funds from reserve to beneficiary [ETH]', async () => {
        const receipt = await controller.withdraw(ETH, { from: authorized })

        assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
      })

      it('it should transfer funds from reserve to beneficiary [ERC20]', async () => {
        const receipt = await controller.withdraw(token1.address, { from: authorized })

        assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
      })
    })

    context('> sender does not have WITHDRAW_ROLE', () => {
      it('it should revert [ETH]', async () => {
        await assertRevert(() => controller.withdraw(ETH, { from: unauthorized }))
      })

      it('it should revert [ERC20]', async () => {
        await assertRevert(() => controller.withdraw(token1.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openBuyOrder
  context('> #openBuyOrder', () => {
    beforeEach(async () => {
      await addCollateralToken(ETH, {
        virtualSupply: VIRTUAL_SUPPLIES[0],
        virtualBalance: VIRTUAL_BALANCES[0],
        reserveRatio: RESERVE_RATIOS[0],
        slippage: Math.pow(10, 22),
      })
      await addCollateralToken(token1.address, {
        virtualSupply: VIRTUAL_SUPPLIES[1],
        virtualBalance: VIRTUAL_BALANCES[1],
        reserveRatio: RESERVE_RATIOS[1],
        slippage: Math.pow(10, 22),
      })
    })

    context('> sender has OPEN_BUY_ORDER_ROLE', () => {
      it('it should open buy order [ETH]', async () => {
        const amount = randomAmount()
        const receipt = await controller.openBuyOrder(ETH, amount, { from: authorized, value: amount })

        assertExternalEvent(receipt, 'NewBuyOrder(address,uint256,address,uint256,uint256)') // market maker
      })

      it('it should open buy order [ERC20]', async () => {
        const receipt = await controller.openBuyOrder(token1.address, randomAmount(), { from: authorized })

        assertExternalEvent(receipt, 'NewBuyOrder(address,uint256,address,uint256,uint256)') // market maker
      })
    })

    context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        const amount = randomAmount()

        await assertRevert(() => controller.openBuyOrder(ETH, amount, { from: unauthorized, value: amount }))
      })

      it('it should revert [ERC20]', async () => {
        await assertRevert(() => controller.openBuyOrder(token1.address, randomAmount(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openSellOrder
  context('> #openSellOrder', () => {
    beforeEach(async () => {
      await addCollateralToken(ETH, {
        virtualSupply: VIRTUAL_SUPPLIES[0],
        virtualBalance: VIRTUAL_BALANCES[0],
        reserveRatio: RESERVE_RATIOS[0],
        slippage: Math.pow(10, 22),
      })
      await addCollateralToken(token1.address, {
        virtualSupply: VIRTUAL_SUPPLIES[1],
        virtualBalance: VIRTUAL_BALANCES[1],
        reserveRatio: RESERVE_RATIOS[1],
        slippage: Math.pow(10, 22),
      })
    })

    context('> sender has OPEN_SELL_ORDER_ROLE', () => {
      it('it should open sell order [ETH]', async () => {
        const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })
        const receipt = await controller.openSellOrder(ETH, balance, { from: authorized })

        assertExternalEvent(receipt, 'NewSellOrder(address,uint256,address,uint256)') // market maker
      })

      it('it should open sell order [ERC20]', async () => {
        const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })
        const receipt = await controller.openSellOrder(token1.address, balance, { from: authorized })

        assertExternalEvent(receipt, 'NewSellOrder(address,uint256,address,uint256)') // market maker
      })
    })

    context('> sender does not have OPEN_SELL_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })

        await assertRevert(() => controller.openSellOrder(ETH, balance, { from: unauthorized }))
      })

      it('it should revert [ERC20]', async () => {
        const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })

        await assertRevert(() => controller.openSellOrder(token1.address, balance, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region claimBuyOrderOrder
  context('> #claimBuyOrder', () => {
    beforeEach(async () => {
      await addCollateralToken(ETH, {
        virtualSupply: VIRTUAL_SUPPLIES[0],
        virtualBalance: VIRTUAL_BALANCES[0],
        reserveRatio: RESERVE_RATIOS[0],
        slippage: Math.pow(10, 22),
      })
      await addCollateralToken(token1.address, {
        virtualSupply: VIRTUAL_SUPPLIES[1],
        virtualBalance: VIRTUAL_BALANCES[1],
        reserveRatio: RESERVE_RATIOS[1],
        slippage: Math.pow(10, 22),
      })
    })

    it('it should return bonds [ETH]', async () => {
      const amount = randomAmount()
      const receipt1 = await controller.openBuyOrder(ETH, amount, { from: authorized, value: amount })
      const batchId = getBuyOrderBatchId(receipt1)

      await progressToNextBatch()
      const receipt2 = await controller.claimBuyOrder(batchId, ETH, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnBuyOrder(address,uint256,address,uint256)') // market maker
    })

    it('it should return bonds [ERC20]', async () => {
      const receipt1 = await controller.openBuyOrder(token1.address, randomAmount(), { from: authorized })
      const batchId = getBuyOrderBatchId(receipt1)

      await progressToNextBatch()
      const receipt2 = await controller.claimBuyOrder(batchId, token1.address, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnBuyOrder(address,uint256,address,uint256)') // market maker
    })
  })
  // #endregion

  // #region claimSellOrder
  context('> #claimSellOrder', () => {
    beforeEach(async () => {
      await addCollateralToken(ETH, {
        virtualSupply: VIRTUAL_SUPPLIES[0],
        virtualBalance: VIRTUAL_BALANCES[0],
        reserveRatio: RESERVE_RATIOS[0],
        slippage: Math.pow(10, 22),
      })
      await addCollateralToken(token1.address, {
        virtualSupply: VIRTUAL_SUPPLIES[1],
        virtualBalance: VIRTUAL_BALANCES[1],
        reserveRatio: RESERVE_RATIOS[1],
        slippage: Math.pow(10, 22),
      })
    })

    it('it should return collateral [ETH]', async () => {
      const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })
      const receipt1 = await controller.openSellOrder(ETH, balance, { from: authorized })
      const batchId = getSellOrderBatchId(receipt1)

      await progressToNextBatch()

      const receipt2 = await controller.claimSellOrder(batchId, ETH, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnSellOrder(address,uint256,address,uint256,uint256)') // market maker
    })

    it('it should return collateral [ERC20]', async () => {
      const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })
      const receipt1 = await controller.openSellOrder(token1.address, balance, { from: authorized })
      const batchId = getSellOrderBatchId(receipt1)

      await progressToNextBatch()

      const receipt2 = await controller.claimSellOrder(batchId, token1.address, { from: authorized })

      assertExternalEvent(receipt2, 'ReturnSellOrder(address,uint256,address,uint256,uint256)') // market maker
    })
  })
  // #endregion

  // #region balanceOf
  context('> #balanceOf', () => {
    context('> reserve', () => {
      it('it should return available reserve balance [ETH]', async () => {
        await forceSendETH(pool.address, INITIAL_ETH_BALANCE)
        await addCollateralToken(ETH, { tap: 10, floor: 0 })

        await progressToNextBatch()
        await progressToNextBatch()

        assert.equal((await controller.balanceOf(pool.address, ETH)).toNumber(), INITIAL_ETH_BALANCE - 10 * 2 * BLOCKS_IN_BATCH)
      })

      it('it should return available reserve balance [ERC20]', async () => {
        const collateral = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)
        await addCollateralToken(collateral.address, { tap: 7, floor: 0 })

        await progressToNextBatch()
        await progressToNextBatch()

        assert.equal((await controller.balanceOf(pool.address, collateral.address)).toNumber(), INITIAL_TOKEN_BALANCE - 7 * 2 * BLOCKS_IN_BATCH)
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

  // #region tokensToHold
  context('> #tokensToHold', () => {
    beforeEach(async () => {
      await addCollateralToken(ETH, {
        virtualSupply: VIRTUAL_SUPPLIES[0],
        virtualBalance: VIRTUAL_BALANCES[0],
        reserveRatio: RESERVE_RATIOS[0],
        slippage: Math.pow(10, 22),
      })
      await addCollateralToken(token1.address, {
        virtualSupply: VIRTUAL_SUPPLIES[1],
        virtualBalance: VIRTUAL_BALANCES[1],
        reserveRatio: RESERVE_RATIOS[1],
        slippage: Math.pow(10, 22),
      })
    })

    context('> collaterals', () => {
      it('it should return collaterals to be claimed [ETH]', async () => {
        const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })
        await controller.openSellOrder(ETH, balance, { from: authorized })
        const collateralsToBeClaimed = await marketMaker.collateralsToBeClaimed(ETH)

        assert.equal((await controller.tokensToHold(ETH)).toNumber(), collateralsToBeClaimed.toNumber())
      })

      it('it should return collaterals to be claimed [ERC20]', async () => {
        const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })
        await controller.openSellOrder(token1.address, balance, { from: authorized })
        const collateralsToBeClaimed = await marketMaker.collateralsToBeClaimed(token1.address)

        assert.equal((await controller.tokensToHold(token1.address)).toNumber(), collateralsToBeClaimed.toNumber())
      })
    })
    context('> other', () => {
      it('it should return zero', async () => {
        const collateral = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)
        assert.equal((await controller.tokensToHold(collateral.address)).toNumber(), 0)
      })
    })
  })
  // #endregion
})
