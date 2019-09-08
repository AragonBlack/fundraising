/* eslint-disable no-undef */
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const sha3 = require('js-sha3').keccak_256
const AllEvents = require('web3/lib/web3/allevents')
const setup = require('./helpers/setup')

const {
  ETH,
  ANY_ADDRESS,
  ZERO_ADDRESS,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PRESALE_GOAL,
  PERCENT_SUPPLY_OFFERED,
  PRESALE_PERIOD,
  MAXIMUM_TAP_RATE_INCREASE_PCT,
  BLOCKS_IN_BATCH,
  SALE_STATE,
  SELL_FEE_PERCENT,
  BUY_FEE_PERCENT,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  MARKET_MAKER_CONTROLLER_BATCH_BLOCKS,
  VIRTUAL_SUPPLIES,
  VIRTUAL_BALANCES,
  RESERVE_RATIOS,
  SLIPPAGES,
  TAPS,
  FLOORS,
} = require('./helpers/constants')

const { now } = require('./helpers/utils')

const progressToNextBatch = require('@ablack/fundraising-shared-test-helpers/progressToNextBatch')(web3, BLOCKS_IN_BATCH)
const {
  randomAmount,
  randomVirtualSupply,
  randomVirtualBalance,
  randomReserveRatio,
  randomSlippage,
  randomTapRate,
  randomTapFloor,
  randomFee,
} = require('@ablack/fundraising-shared-test-helpers/randomness')

const { getEvent } = require('@ablack/fundraising-shared-test-helpers/events')

const assertExternalEvent = (tx, eventName, instances = 1) => {
  const events = tx.receipt.logs.filter(l => {
    return l.topics[0] === '0x' + sha3(eventName)
  })
  assert.equal(events.length, instances, `'${eventName}' event should have been fired ${instances} times`)
  return events
}

contract('AragonFundraisingController app', ([root, authorized, unauthorized]) => {
  const decodeEventsForContract = (contract, receipt) => {
    const ae = new AllEvents(contract._web3, contract.abi, contract.address)

    // ae.decode mutates the args, so we deep copy
    return JSON.parse(JSON.stringify(receipt))
      .logs.filter(l => l.address === contract.address)
      .map(l => ae.decode(l))
  }

  const getBuyOrderBatchId = tx => {
    const events = decodeEventsForContract(this.marketMaker, tx.receipt)
    const event = events.filter(l => {
      return l.event === 'NewBuyOrder'
    })[0]

    return event.args.batchId
  }

  const getSellOrderBatchId = tx => {
    const events = decodeEventsForContract(this.marketMaker, tx.receipt)
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
    await setup.deploy.infrastructure(this)
  })

  beforeEach(async () => {
    await setup.deploy.organization(this, root, authorized)
    await progressToNextBatch()
  })

  // #region initialize
  // context('> #initialize', () => {
  //   context('> initialization parameters are valid', () => {
  //     it('it should initialize controller', async () => {
  //       assert.equal(await this.controller.presale(), this.presale.address)
  //       assert.equal(await this.controller.marketMaker(), this.marketMaker.address)
  //       assert.equal(await this.controller.reserve(), this.reserve.address)
  //       assert.equal(await this.controller.tap(), this.tap.address)
  //     })
  //   })

  //   // context('> initialization parameters are not valid', () => {
  //   //   it('it should revert [market maker is not a contract]', async () => {
  //   //     const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
  //   //     const uninitialized = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))

  //   //     await assertRevert(() => uninitialized.initialize(authorized, pool.address, tap.address, { from: root }))
  //   //   })

  //   //   it('it should revert [reserve is not a contract]', async () => {
  //   //     const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
  //   //     const uninitialized = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))

  //   //     await assertRevert(() => uninitialized.initialize(marketMaker.address, authorized, tap.address, { from: root }))
  //   //   })

  //   //   it('it should revert [tap is not a contract]', async () => {
  //   //     const cReceipt = await dao.newAppInstance(FUNDRAISING_CONTROLLER_ID, cBase.address, '0x', false)
  //   //     const uninitialized = await Controller.at(getEvent(cReceipt, 'NewAppProxy', 'proxy'))

  //   //     await assertRevert(() => uninitialized.initialize(marketMaker.address, pool.address, authorized, { from: root }))
  //   //   })
  //   // })

  //   it('it should revert on re-initialization', async () => {
  //     await assertRevert(() => setup.initialize.controller(this, root))
  //   })
  // })
  // #endregion

  // #region updateBeneficiary
  context('> #updateBeneficiary', () => {
    context('> sender has UPDATE_BENEFICIARY_ROLE', () => {
      it('it should update beneficiary', async () => {
        const receipt = await this.controller.updateBeneficiary(root, { from: authorized })

        assertExternalEvent(receipt, 'UpdateBeneficiary(address)', 2)
        // double checked that the transaction has been dispatched both in marketMaker and tap
        assert.equal(await this.marketMaker.beneficiary(), root)
        assert.equal(await this.tap.beneficiary(), root)
      })
    })

    context('> sender does not have UPDATE_BENEFICIARY_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.updateBeneficiary(root, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateFees
  context('> #updateFees', () => {
    context('> sender has UPDATE_FEES_ROLE', () => {
      it('it should update fees', async () => {
        const receipt = await this.controller.updateFees(randomFee(), randomFee(), { from: authorized })

        assertExternalEvent(receipt, 'UpdateFees(uint256,uint256)')
      })
    })

    context('> sender does not have UPDATE_FEES_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.updateFees(randomFee(), randomFee(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openPresale
  context('> #openPresale', () => {
    context('> sender has OPEN_PRESALE_ROLE', () => {
      it('it should open presale', async () => {
        await this.controller.openPresale({ from: authorized })

        assert.equal((await this.presale.currentPresaleState()).toNumber(), SALE_STATE.FUNDING)
      })
    })

    context('> sender does not have OPEN_PRESALE_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.openPresale({ from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region closePresale
  context('> #closePresale', () => {
    beforeEach(async () => {
      await this.controller.openPresale({ from: authorized })
      await this.controller.contribute(PRESALE_GOAL, { from: authorized })
    })

    it('it should close presale', async () => {
      await this.controller.closePresale({ from: authorized })

      assert.equal((await this.presale.currentPresaleState()).toNumber(), SALE_STATE.CLOSED)
    })
  })
  // #endregion

  // #region contribute
  context('> #contribute', () => {
    beforeEach(async () => {
      await this.controller.openPresale({ from: authorized })
    })

    context('> sender has CONTRIBUTE_ROLE', () => {
      it('it should forward contribution', async () => {
        const receipt = await this.controller.contribute(PRESALE_GOAL / 2, { from: authorized })

        assertExternalEvent(receipt, 'Contribute(address,uint256,uint256,uint256)')
      })
    })

    context('> sender does not have CONTRIBUTE_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.contribute(PRESALE_GOAL / 2, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region refund
  context('> #refund', () => {
    beforeEach(async () => {
      await this.controller.openPresale({ from: authorized })
      await this.controller.contribute(PRESALE_GOAL / 2, { from: authorized })
      await this.presale.mockSetTimestamp(now() + PRESALE_PERIOD)
    })

    it('it should refund user', async () => {
      const receipt = await this.controller.refund(authorized, 0, { from: authorized })

      assertExternalEvent(receipt, 'Refund(address,uint256,uint256,uint256)')
    })
  })
  // #endregion

  // #region updateMaximumTapIncreasePct
  // context('> #updateMaximumTapIncreasePct', () => {
  //   context('> sender has UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE', () => {
  //     it('it should update maximum tap increase percentage', async () => {
  //       const receipt = await controller.updateMaximumTapIncreasePct(70 * Math.pow(10, 16), { from: authorized })

  //       assertExternalEvent(receipt, 'UpdateMaximumTapIncreasePct(uint256)') // tap
  //     })
  //   })

  //   context('> sender does not have UPDATE_MAXIMUM_TAP_INCREASE_PCT_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() => controller.updateMaximumTapIncreasePct(70 * Math.pow(10, 16), { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region addCollateralToken
  // context('> #addCollateralToken', () => {
  //   context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should add collateral token', async () => {
  //       const receipt1 = await controller.addCollateralToken(
  //         token1.address,
  //         randomVirtualSupply(),
  //         randomVirtualBalance(),
  //         randomReserveRatio(),
  //         randomSlippage(),
  //         randomTap(),
  //         randomFloor(),
  //         {
  //           from: authorized,
  //         }
  //       )

  //       const receipt2 = await controller.addCollateralToken(
  //         ETH,
  //         randomVirtualSupply(),
  //         randomVirtualBalance(),
  //         randomReserveRatio(),
  //         randomSlippage(),
  //         randomTap(),
  //         randomFloor(),
  //         {
  //           from: authorized,
  //         }
  //       )

  //       assertExternalEvent(receipt1, 'AddCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
  //       assertExternalEvent(receipt1, 'AddTappedToken(address,uint256,uint256)') // tap
  //       assertExternalEvent(receipt1, 'AddProtectedToken(address)') // pool

  //       assertExternalEvent(receipt2, 'AddCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
  //       assertExternalEvent(receipt2, 'AddTappedToken(address,uint256,uint256)') // tap
  //       assertExternalEvent(receipt2, 'AddProtectedToken(address)', 0) // ETH should not be added as a protected token into the pool
  //     })
  //   })

  //   context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() =>
  //         controller.addCollateralToken(
  //           token1.address,
  //           randomVirtualSupply(),
  //           randomVirtualBalance(),
  //           randomReserveRatio(),
  //           randomSlippage(),
  //           randomTap(),
  //           randomFloor(),
  //           {
  //             from: unauthorized,
  //           }
  //         )
  //       )
  //     })
  //   })
  // })
  // #endregion

  // #region removeCollateralToken
  // context('> #removeCollateralToken', () => {
  //   beforeEach(async () => {
  //     await controller.addCollateralToken(
  //       token1.address,
  //       randomVirtualSupply(),
  //       randomVirtualBalance(),
  //       randomReserveRatio(),
  //       randomSlippage(),
  //       randomTap(),
  //       randomFloor(),
  //       {
  //         from: authorized,
  //       }
  //     )

  //     await controller.addCollateralToken(
  //       ETH,
  //       randomVirtualSupply(),
  //       randomVirtualBalance(),
  //       randomReserveRatio(),
  //       randomSlippage(),
  //       randomTap(),
  //       randomFloor(),
  //       {
  //         from: authorized,
  //       }
  //     )
  //   })

  //   context('> sender has REMOVE_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should remove collateral token', async () => {
  //       const receipt1 = await controller.removeCollateralToken(token1.address, { from: authorized })
  //       const receipt2 = await controller.removeCollateralToken(ETH, { from: authorized })

  //       assertExternalEvent(receipt1, 'RemoveCollateralToken(address)') // market maker
  //       assertExternalEvent(receipt2, 'RemoveCollateralToken(address)') // market maker
  //     })
  //   })

  //   context('> sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should revert', async () => {
  //       controller.removeCollateralToken(token1.address, { from: authorized })
  //     })
  //   })
  // })
  // #endregion

  // #region updateCollateralToken
  // context('> #updateCollateralToken', () => {
  //   context('> sender has UPDATE_COLLATERAL_TOKEN_ROLE', () => {
  //     beforeEach(async () => {
  //       await controller.addCollateralToken(
  //         token1.address,
  //         randomVirtualSupply(),
  //         randomVirtualBalance(),
  //         randomReserveRatio(),
  //         randomSlippage(),
  //         randomTap(),
  //         randomFloor(),
  //         {
  //           from: authorized,
  //         }
  //       )
  //     })

  //     it('it should update collateral token', async () => {
  //       const receipt = await controller.updateCollateralToken(
  //         token1.address,
  //         randomVirtualSupply(),
  //         randomVirtualBalance(),
  //         randomReserveRatio(),
  //         randomSlippage(),
  //         { from: authorized }
  //       )

  //       assertExternalEvent(receipt, 'UpdateCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
  //     })
  //   })

  //   context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() => controller.updateTokenTap(token1.address, randomTap(), randomFloor(), { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region updateTokenTap
  // context('> #updateTokenTap', () => {
  //   context('> sender has UPDATE_TOKEN_TAP_ROLE', () => {
  //     beforeEach(async () => {
  //       await controller.addCollateralToken(
  //         token1.address,
  //         randomVirtualSupply(),
  //         randomVirtualBalance(),
  //         randomReserveRatio(),
  //         randomSlippage(),
  //         10,
  //         randomFloor(),
  //         {
  //           from: authorized,
  //         }
  //       )

  //       await timeTravel(2592001) // 1 month = 2592000 seconds
  //     })

  //     it('it should update token tap', async () => {
  //       const receipt = await controller.updateTokenTap(token1.address, 14, randomFloor(), { from: authorized })

  //       assertExternalEvent(receipt, 'UpdateTappedToken(address,uint256,uint256)') // tap
  //     })
  //   })

  //   context('> sender does not have UPDATE_TOKEN_TAP_ROLE', () => {
  //     it('it should revert', async () => {
  //       await assertRevert(() => controller.updateTokenTap(token1.address, randomTap(), randomFloor(), { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region withdraw
  // context('> #withdraw', () => {
  //   beforeEach(async () => {
  //     await forceSendETH(pool.address, INITIAL_ETH_BALANCE)
  //     await token1.transfer(pool.address, INITIAL_TOKEN_BALANCE, { from: authorized })

  //     await controller.addCollateralToken(ETH, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), 10, 0, {
  //       from: authorized,
  //     })

  //     await controller.addCollateralToken(token1.address, randomVirtualSupply(), randomVirtualBalance(), randomReserveRatio(), randomSlippage(), 10, 0, {
  //       from: authorized,
  //     })

  //     await increaseBlocks(1000)
  //   })

  //   context('> sender has WITHDRAW_ROLE', () => {
  //     it('it should transfer funds from reserve to beneficiary [ETH]', async () => {
  //       const receipt = await controller.withdraw(ETH, { from: authorized })

  //       assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
  //     })

  //     it('it should transfer funds from reserve to beneficiary [ERC20]', async () => {
  //       const receipt = await controller.withdraw(token1.address, { from: authorized })

  //       assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
  //     })
  //   })

  //   context('> sender does not have WITHDRAW_ROLE', () => {
  //     it('it should revert [ETH]', async () => {
  //       await assertRevert(() => controller.withdraw(ETH, { from: unauthorized }))
  //     })

  //     it('it should revert [ERC20]', async () => {
  //       await assertRevert(() => controller.withdraw(token1.address, { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region openBuyOrder
  // context('> #openBuyOrder', () => {
  //   beforeEach(async () => {
  //     await addCollateralToken(ETH, {
  //       virtualSupply: VIRTUAL_SUPPLIES[0],
  //       virtualBalance: VIRTUAL_BALANCES[0],
  //       reserveRatio: RESERVE_RATIOS[0],
  //       slippage: Math.pow(10, 22),
  //     })
  //     await addCollateralToken(token1.address, {
  //       virtualSupply: VIRTUAL_SUPPLIES[1],
  //       virtualBalance: VIRTUAL_BALANCES[1],
  //       reserveRatio: RESERVE_RATIOS[1],
  //       slippage: Math.pow(10, 22),
  //     })
  //   })

  //   context('> sender has OPEN_BUY_ORDER_ROLE', () => {
  //     it('it should open buy order [ETH]', async () => {
  //       const amount = randomAmount()
  //       const receipt = await controller.openBuyOrder(ETH, amount, { from: authorized, value: amount })

  //       assertExternalEvent(receipt, 'NewBuyOrder(address,uint256,address,uint256,uint256)') // market maker
  //     })

  //     it('it should open buy order [ERC20]', async () => {
  //       const receipt = await controller.openBuyOrder(token1.address, randomAmount(), { from: authorized })

  //       assertExternalEvent(receipt, 'NewBuyOrder(address,uint256,address,uint256,uint256)') // market maker
  //     })
  //   })

  //   context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
  //     it('it should revert [ETH]', async () => {
  //       const amount = randomAmount()

  //       await assertRevert(() => controller.openBuyOrder(ETH, amount, { from: unauthorized, value: amount }))
  //     })

  //     it('it should revert [ERC20]', async () => {
  //       await assertRevert(() => controller.openBuyOrder(token1.address, randomAmount(), { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region openSellOrder
  // context('> #openSellOrder', () => {
  //   beforeEach(async () => {
  //     await addCollateralToken(ETH, {
  //       virtualSupply: VIRTUAL_SUPPLIES[0],
  //       virtualBalance: VIRTUAL_BALANCES[0],
  //       reserveRatio: RESERVE_RATIOS[0],
  //       slippage: Math.pow(10, 22),
  //     })
  //     await addCollateralToken(token1.address, {
  //       virtualSupply: VIRTUAL_SUPPLIES[1],
  //       virtualBalance: VIRTUAL_BALANCES[1],
  //       reserveRatio: RESERVE_RATIOS[1],
  //       slippage: Math.pow(10, 22),
  //     })
  //   })

  //   context('> sender has OPEN_SELL_ORDER_ROLE', () => {
  //     it('it should open sell order [ETH]', async () => {
  //       const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })
  //       const receipt = await controller.openSellOrder(ETH, balance, { from: authorized })

  //       assertExternalEvent(receipt, 'NewSellOrder(address,uint256,address,uint256)') // market maker
  //     })

  //     it('it should open sell order [ERC20]', async () => {
  //       const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })
  //       const receipt = await controller.openSellOrder(token1.address, balance, { from: authorized })

  //       assertExternalEvent(receipt, 'NewSellOrder(address,uint256,address,uint256)') // market maker
  //     })
  //   })

  //   context('> sender does not have OPEN_SELL_ORDER_ROLE', () => {
  //     it('it should revert [ETH]', async () => {
  //       const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })

  //       await assertRevert(() => controller.openSellOrder(ETH, balance, { from: unauthorized }))
  //     })

  //     it('it should revert [ERC20]', async () => {
  //       const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })

  //       await assertRevert(() => controller.openSellOrder(token1.address, balance, { from: unauthorized }))
  //     })
  //   })
  // })
  // #endregion

  // #region claimBuyOrderOrder
  // context('> #claimBuyOrder', () => {
  //   beforeEach(async () => {
  //     await addCollateralToken(ETH, {
  //       virtualSupply: VIRTUAL_SUPPLIES[0],
  //       virtualBalance: VIRTUAL_BALANCES[0],
  //       reserveRatio: RESERVE_RATIOS[0],
  //       slippage: Math.pow(10, 22),
  //     })
  //     await addCollateralToken(token1.address, {
  //       virtualSupply: VIRTUAL_SUPPLIES[1],
  //       virtualBalance: VIRTUAL_BALANCES[1],
  //       reserveRatio: RESERVE_RATIOS[1],
  //       slippage: Math.pow(10, 22),
  //     })
  //   })

  //   it('it should return bonds [ETH]', async () => {
  //     const amount = randomAmount()
  //     const receipt1 = await controller.openBuyOrder(ETH, amount, { from: authorized, value: amount })
  //     const batchId = getBuyOrderBatchId(receipt1)

  //     await progressToNextBatch()
  //     const receipt2 = await controller.claimBuyOrder(batchId, ETH, { from: authorized })

  //     assertExternalEvent(receipt2, 'ReturnBuyOrder(address,uint256,address,uint256)') // market maker
  //   })

  //   it('it should return bonds [ERC20]', async () => {
  //     const receipt1 = await controller.openBuyOrder(token1.address, randomAmount(), { from: authorized })
  //     const batchId = getBuyOrderBatchId(receipt1)

  //     await progressToNextBatch()
  //     const receipt2 = await controller.claimBuyOrder(batchId, token1.address, { from: authorized })

  //     assertExternalEvent(receipt2, 'ReturnBuyOrder(address,uint256,address,uint256)') // market maker
  //   })
  // })
  // #endregion

  // #region claimSellOrder
  // context('> #claimSellOrder', () => {
  //   beforeEach(async () => {
  //     await addCollateralToken(ETH, {
  //       virtualSupply: VIRTUAL_SUPPLIES[0],
  //       virtualBalance: VIRTUAL_BALANCES[0],
  //       reserveRatio: RESERVE_RATIOS[0],
  //       slippage: Math.pow(10, 22),
  //     })
  //     await addCollateralToken(token1.address, {
  //       virtualSupply: VIRTUAL_SUPPLIES[1],
  //       virtualBalance: VIRTUAL_BALANCES[1],
  //       reserveRatio: RESERVE_RATIOS[1],
  //       slippage: Math.pow(10, 22),
  //     })
  //   })

  //   it('it should return collateral [ETH]', async () => {
  //     const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })
  //     const receipt1 = await controller.openSellOrder(ETH, balance, { from: authorized })
  //     const batchId = getSellOrderBatchId(receipt1)

  //     await progressToNextBatch()

  //     const receipt2 = await controller.claimSellOrder(batchId, ETH, { from: authorized })

  //     assertExternalEvent(receipt2, 'ReturnSellOrder(address,uint256,address,uint256,uint256)') // market maker
  //   })

  //   it('it should return collateral [ERC20]', async () => {
  //     const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })
  //     const receipt1 = await controller.openSellOrder(token1.address, balance, { from: authorized })
  //     const batchId = getSellOrderBatchId(receipt1)

  //     await progressToNextBatch()

  //     const receipt2 = await controller.claimSellOrder(batchId, token1.address, { from: authorized })

  //     assertExternalEvent(receipt2, 'ReturnSellOrder(address,uint256,address,uint256,uint256)') // market maker
  //   })
  // })
  // #endregion

  // #region balanceOf
  // context('> #balanceOf', () => {
  //   context('> reserve', () => {
  //     it('it should return available reserve balance [ETH]', async () => {
  //       await forceSendETH(pool.address, INITIAL_ETH_BALANCE)
  //       await addCollateralToken(ETH, { tap: 10, floor: 0 })

  //       await progressToNextBatch()
  //       await progressToNextBatch()

  //       assert.equal((await controller.balanceOf(pool.address, ETH)).toNumber(), INITIAL_ETH_BALANCE - 10 * 2 * BLOCKS_IN_BATCH)
  //     })

  //     it('it should return available reserve balance [ERC20]', async () => {
  //       const collateral = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)
  //       await addCollateralToken(collateral.address, { tap: 7, floor: 0 })

  //       await progressToNextBatch()
  //       await progressToNextBatch()

  //       assert.equal((await controller.balanceOf(pool.address, collateral.address)).toNumber(), INITIAL_TOKEN_BALANCE - 7 * 2 * BLOCKS_IN_BATCH)
  //     })
  //   })
  //   context('> other', () => {
  //     it('it should return balance [ETH]', async () => {
  //       assert.equal((await controller.balanceOf(authorized, ETH)).toNumber(), (await web3.eth.getBalance(authorized)).toNumber())
  //     })

  //     it('it should return balance [ETH]', async () => {
  //       assert.equal((await controller.balanceOf(authorized, token1.address)).toNumber(), (await token1.balanceOf(authorized)).toNumber())
  //     })
  //   })
  // })
  // #endregion

  // #region tokensToHold
  // context('> #tokensToHold', () => {
  //   beforeEach(async () => {
  //     await addCollateralToken(ETH, {
  //       virtualSupply: VIRTUAL_SUPPLIES[0],
  //       virtualBalance: VIRTUAL_BALANCES[0],
  //       reserveRatio: RESERVE_RATIOS[0],
  //       slippage: Math.pow(10, 22),
  //     })
  //     await addCollateralToken(token1.address, {
  //       virtualSupply: VIRTUAL_SUPPLIES[1],
  //       virtualBalance: VIRTUAL_BALANCES[1],
  //       reserveRatio: RESERVE_RATIOS[1],
  //       slippage: Math.pow(10, 22),
  //     })
  //   })

  //   context('> collaterals', () => {
  //     it('it should return collaterals to be claimed [ETH]', async () => {
  //       const balance = await openAndClaimBuyOrder(ETH, randomAmount(), { from: authorized })
  //       await controller.openSellOrder(ETH, balance, { from: authorized })
  //       const collateralsToBeClaimed = await marketMaker.collateralsToBeClaimed(ETH)

  //       assert.equal((await controller.tokensToHold(ETH)).toNumber(), collateralsToBeClaimed.toNumber())
  //     })

  //     it('it should return collaterals to be claimed [ERC20]', async () => {
  //       const balance = await openAndClaimBuyOrder(token1.address, randomAmount(), { from: authorized })
  //       await controller.openSellOrder(token1.address, balance, { from: authorized })
  //       const collateralsToBeClaimed = await marketMaker.collateralsToBeClaimed(token1.address)

  //       assert.equal((await controller.tokensToHold(token1.address)).toNumber(), collateralsToBeClaimed.toNumber())
  //     })
  //   })
  //   context('> other', () => {
  //     it('it should return zero', async () => {
  //       const collateral = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)
  //       assert.equal((await controller.tokensToHold(collateral.address)).toNumber(), 0)
  //     })
  //   })
  // })
  // #endregion
})
