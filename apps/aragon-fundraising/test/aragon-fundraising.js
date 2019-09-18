const Controller = artifacts.require('AragonFundraisingController')
const {
  ETH,
  INITIAL_COLLATERAL_BALANCE,
  PRESALE_GOAL,
  PRESALE_PERIOD,
  PRESALE_STATE,
  BATCH_BLOCKS,
  RATES,
  FLOORS,
} = require('@ablack/fundraising-shared-test-helpers/constants')
const setup = require('./helpers/setup')
const { now, getBuyOrderBatchId, getSellOrderBatchId } = require('./helpers/utils')
const openAndClaimBuyOrder = require('./helpers/utils').openAndClaimBuyOrder(web3, BATCH_BLOCKS)
const assertExternalEvent = require('@ablack/fundraising-shared-test-helpers/assertExternalEvent')
const forceSendETH = require('@ablack/fundraising-shared-test-helpers/forceSendETH')
const getProxyAddress = require('@ablack/fundraising-shared-test-helpers/getProxyAddress')
const random = require('@ablack/fundraising-shared-test-helpers/random')
const increaseBlocks = require('@ablack/fundraising-shared-test-helpers/increaseBlocks')(web3)
const progressToNextBatch = require('@ablack/fundraising-shared-test-helpers/progressToNextBatch')(web3, BATCH_BLOCKS)
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

contract('AragonFundraisingController app', ([root, authorized, unauthorized]) => {
  before(async () => {
    await setup.deploy.infrastructure(this)
  })

  beforeEach(async () => {
    await setup.deploy.organization(this, root, authorized)
    await progressToNextBatch()
  })

  // #region initialize
  context('> #initialize', () => {
    context('> initialization parameters are valid', () => {
      it('it should initialize controller', async () => {
        assert.equal(await this.controller.presale(), this.presale.address)
        assert.equal(await this.controller.marketMaker(), this.marketMaker.address)
        assert.equal(await this.controller.reserve(), this.reserve.address)
        assert.equal(await this.controller.tap(), this.tap.address)
        assert.equal(await this.controller.toReset(0), this.collaterals.dai.address)
        await assertRevert(() => this.controller.toReset(1))
      })
    })

    context('> initialization parameters are not valid', () => {
      let uninitialized

      beforeEach(async () => {
        const receipt = await this.dao.newAppInstance(setup.ids.controller, this.base.controller.address, '0x', false)
        uninitialized = await Controller.at(getProxyAddress(receipt))
      })

      it('it should revert [presale is not a contract]', async () => {
        await assertRevert(() =>
          uninitialized.initialize(root, this.marketMaker.address, this.reserve.address, this.tap.address, [this.collaterals.dai.address], { from: root })
        )
      })

      it('it should revert [market maker is not a contract]', async () => {
        await assertRevert(() =>
          uninitialized.initialize(this.presale.address, root, this.reserve.address, this.tap.address, [this.collaterals.dai.address], { from: root })
        )
      })

      it('it should revert [reserve is not a contract]', async () => {
        await assertRevert(() =>
          uninitialized.initialize(this.presale.address, this.marketMaker.address, root, this.tap.address, [this.collaterals.dai.address], { from: root })
        )
      })

      it('it should revert [tap is not a contract]', async () => {
        await assertRevert(() =>
          uninitialized.initialize(this.presale.address, this.marketMaker.address, this.reserve.address, root, [this.collaterals.dai.address], { from: root })
        )
      })

      it('it should revert [toReset tokens are not contract or ETH]', async () => {
        await assertRevert(() =>
          uninitialized.initialize(this.presale.address, this.marketMaker.address, this.reserve.address, this.tap.address, [root], { from: root })
        )
      })
    })

    it('it should revert on re-initialization', async () => {
      await assertRevert(() => setup.initialize.controller(this, root))
    })
  })
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
        const receipt = await this.controller.updateFees(random.fee(), random.fee(), { from: authorized })

        assertExternalEvent(receipt, 'UpdateFees(uint256,uint256)')
      })
    })

    context('> sender does not have UPDATE_FEES_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.updateFees(random.fee(), random.fee(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openPresale
  context('> #openPresale', () => {
    context('> sender has OPEN_PRESALE_ROLE', () => {
      it('it should open presale', async () => {
        await this.controller.openPresale({ from: authorized })

        assert.equal((await this.presale.state()).toNumber(), PRESALE_STATE.FUNDING)
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

      assert.equal((await this.presale.state()).toNumber(), PRESALE_STATE.CLOSED)
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

    it('it should refund buyer', async () => {
      const receipt = await this.controller.refund(authorized, 0, { from: authorized })

      assertExternalEvent(receipt, 'Refund(address,uint256,uint256,uint256)')
    })
  })
  // #endregion

  // #region openTrading
  context('> #openTrading', () => {
    context('> sender has OPEN_TRADING_ROLE', () => {
      it('it should open trading', async () => {
        const receipt = await this.controller.openTrading({ from: authorized })

        assertExternalEvent(receipt, 'Open()')
      })

      it('it should reset toReset tokens taps', async () => {
        const receipt = await this.controller.openTrading({ from: authorized })

        assertExternalEvent(receipt, 'ResetTappedToken(address)')
      })
    })

    context('> sender does not have OPEN_TRADING_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.openTrading({ from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openBuyOrder
  context('> #openBuyOrder', () => {
    beforeEach(async () => {
      await this.controller.openTrading({ from: authorized })
    })

    context('> sender has OPEN_BUY_ORDER_ROLE', () => {
      it('it should open buy order [ETH]', async () => {
        const amount = random.amount()
        const receipt = await this.controller.openBuyOrder(ETH, amount, { from: authorized, value: amount })

        assertExternalEvent(receipt, 'OpenBuyOrder(address,uint256,address,uint256,uint256)')
      })

      it('it should open buy order [ERC20]', async () => {
        const receipt = await this.controller.openBuyOrder(this.collaterals.dai.address, random.amount(), { from: authorized })

        assertExternalEvent(receipt, 'OpenBuyOrder(address,uint256,address,uint256,uint256)')
      })
    })

    context('> sender does not have OPEN_BUY_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        const amount = random.amount()

        await assertRevert(() => this.controller.openBuyOrder(ETH, amount, { from: unauthorized, value: amount }))
      })

      it('it should revert [ERC20]', async () => {
        await assertRevert(() => this.controller.openBuyOrder(this.collaterals.dai.address, random.amount(), { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region openSellOrder
  context('> #openSellOrder', () => {
    beforeEach(async () => {
      await this.controller.openTrading({ from: authorized })
    })

    context('> sender has OPEN_SELL_ORDER_ROLE', () => {
      it('it should open sell order [ETH]', async () => {
        const balance = await openAndClaimBuyOrder(this, ETH, random.amount(), { from: authorized })
        const receipt = await this.controller.openSellOrder(ETH, balance, { from: authorized })

        assertExternalEvent(receipt, 'OpenSellOrder(address,uint256,address,uint256)')
      })

      it('it should open sell order [ERC20]', async () => {
        const balance = await openAndClaimBuyOrder(this, this.collaterals.dai.address, random.amount(), { from: authorized })
        const receipt = await this.controller.openSellOrder(this.collaterals.dai.address, balance, { from: authorized })

        assertExternalEvent(receipt, 'OpenSellOrder(address,uint256,address,uint256)')
      })
    })

    context('> sender does not have OPEN_SELL_ORDER_ROLE', () => {
      it('it should revert [ETH]', async () => {
        const balance = await openAndClaimBuyOrder(this, ETH, random.amount(), { from: authorized })
        await this.token.transfer(unauthorized, balance, { from: authorized })

        await assertRevert(() => this.controller.openSellOrder(ETH, balance, { from: unauthorized }))
      })

      it('it should revert [ERC20]', async () => {
        const balance = await openAndClaimBuyOrder(this, this.collaterals.dai.address, random.amount(), { from: authorized })
        await this.token.transfer(unauthorized, balance, { from: authorized })

        await assertRevert(() => this.controller.openSellOrder(this.collaterals.dai.address, balance, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region claimBuyOrderOrder
  context('> #claimBuyOrder', () => {
    beforeEach(async () => {
      await this.controller.openTrading({ from: authorized })
    })

    it('it should claim bonds [ETH]', async () => {
      const amount = random.amount()
      const receipt1 = await this.controller.openBuyOrder(ETH, amount, { from: authorized, value: amount })
      const batchId = getBuyOrderBatchId(this, receipt1)

      await progressToNextBatch()
      const receipt2 = await this.controller.claimBuyOrder(authorized, batchId, ETH, { from: authorized })

      assertExternalEvent(receipt2, 'ClaimBuyOrder(address,uint256,address,uint256)')
    })

    it('it should claim bonds [ERC20]', async () => {
      const receipt1 = await this.controller.openBuyOrder(this.collaterals.dai.address, random.amount(), { from: authorized })
      const batchId = getBuyOrderBatchId(this, receipt1)

      await progressToNextBatch()
      const receipt2 = await this.controller.claimBuyOrder(authorized, batchId, this.collaterals.dai.address, { from: authorized })

      assertExternalEvent(receipt2, 'ClaimBuyOrder(address,uint256,address,uint256)')
    })
  })
  // #endregion

  // #region claimSellOrder
  context('> #claimSellOrder', () => {
    beforeEach(async () => {
      await this.controller.openTrading({ from: authorized })
    })

    it('it should claim collateral [ETH]', async () => {
      const balance = await openAndClaimBuyOrder(this, ETH, random.amount(), { from: authorized })
      const receipt1 = await this.controller.openSellOrder(ETH, balance, { from: authorized })
      const batchId = getSellOrderBatchId(this, receipt1)

      await progressToNextBatch()

      const receipt2 = await this.controller.claimSellOrder(authorized, batchId, ETH, { from: authorized })

      assertExternalEvent(receipt2, 'ClaimSellOrder(address,uint256,address,uint256,uint256)') // market maker
    })

    it('it should claim collateral [ERC20]', async () => {
      const balance = await openAndClaimBuyOrder(this, this.collaterals.dai.address, random.amount(), { from: authorized })
      const receipt1 = await this.controller.openSellOrder(this.collaterals.dai.address, balance, { from: authorized })
      const batchId = getSellOrderBatchId(this, receipt1)

      await progressToNextBatch()

      const receipt2 = await this.controller.claimSellOrder(authorized, batchId, this.collaterals.dai.address, { from: authorized })

      assertExternalEvent(receipt2, 'ClaimSellOrder(address,uint256,address,uint256,uint256)') // market maker
    })
  })
  // #endregion

  // #region addCollateralToken
  context('> #addCollateralToken', () => {
    context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should add collateral token', async () => {
        const receipt = await this.controller.addCollateralToken(
          this.collaterals.ant.address,
          random.virtualSupply(),
          random.virtualBalance(),
          random.reserveRatio(),
          random.slippage(),
          random.rate(),
          random.floor(),
          {
            from: authorized,
          }
        )

        assertExternalEvent(receipt, 'AddCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
        assertExternalEvent(receipt, 'AddProtectedToken(address)') // pool
        assertExternalEvent(receipt, 'AddTappedToken(address,uint256,uint256)') // tap
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          this.controller.addCollateralToken(
            this.collaterals.ant.address,
            random.virtualSupply(),
            random.virtualBalance(),
            random.reserveRatio(),
            random.slippage(),
            random.rate(),
            random.floor(),
            {
              from: unauthorized,
            }
          )
        )
      })
    })
  })
  // #endregion

  // #region reAddCollateralToken
  context('> #reAddCollateralToken', () => {
    beforeEach(async () => {
      await this.controller.removeCollateralToken(this.collaterals.dai.address, { from: authorized })
    })

    context('> sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should re-add collateral token', async () => {
        const receipt = await this.controller.reAddCollateralToken(
          this.collaterals.dai.address,
          random.virtualSupply(),
          random.virtualBalance(),
          random.reserveRatio(),
          random.slippage(),
          {
            from: authorized,
          }
        )

        assertExternalEvent(receipt, 'AddCollateralToken(address,uint256,uint256,uint32,uint256)') // market maker
      })
    })

    context('> sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          this.controller.reAddCollateralToken(
            this.collaterals.dai.address,
            random.virtualSupply(),
            random.virtualBalance(),
            random.reserveRatio(),
            random.slippage(),
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
    context('> sender has REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should remove collateral token', async () => {
        const receipt1 = await this.controller.removeCollateralToken(this.collaterals.dai.address, { from: authorized })

        assertExternalEvent(receipt1, 'RemoveCollateralToken(address)')
      })
    })

    context('> sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.removeCollateralToken(this.collaterals.dai.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateCollateralToken
  context('> #updateCollateralToken', () => {
    context('> sender has UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should update collateral token', async () => {
        const receipt = await this.controller.updateCollateralToken(
          this.collaterals.dai.address,
          random.virtualSupply(),
          random.virtualBalance(),
          random.reserveRatio(),
          random.slippage(),
          { from: authorized }
        )

        assertExternalEvent(receipt, 'UpdateCollateralToken(address,uint256,uint256,uint32,uint256)')
      })
    })

    context('> sender does not have UPDATE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() =>
          this.controller.updateCollateralToken(
            this.collaterals.dai.address,
            random.virtualSupply(),
            random.virtualBalance(),
            random.reserveRatio(),
            random.slippage(),
            { from: unauthorized }
          )
        )
      })
    })
  })
  // #endregion

  // #region updateMaximumTapRateIncreasePct
  context('> #updateMaximumTapRateIncreasePct', () => {
    context('> sender has UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE', () => {
      it('it should update maximum tap rate increase percentage', async () => {
        const receipt = await this.controller.updateMaximumTapRateIncreasePct(70, { from: authorized })

        assertExternalEvent(receipt, 'UpdateMaximumTapRateIncreasePct(uint256)')
      })
    })

    context('> sender does not have UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.updateMaximumTapRateIncreasePct(70, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateMaximumTapFloorDecreasePct
  context('> #updateMaximumTapFloorDecreasePct', () => {
    context('> sender has UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE', () => {
      it('it should update maximum tap floor decrease percentage', async () => {
        const receipt = await this.controller.updateMaximumTapFloorDecreasePct(70, { from: authorized })

        assertExternalEvent(receipt, 'UpdateMaximumTapFloorDecreasePct(uint256)')
      })
    })

    context('> sender does not have UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.updateMaximumTapFloorDecreasePct(70, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region updateTokenTap
  context('> #updateTokenTap', () => {
    context('> sender has UPDATE_TOKEN_TAP_ROLE', () => {
      beforeEach(async () => {
        await timeTravel(2592001) // 1 month = 2592000 seconds
      })

      it('it should update token tap', async () => {
        const receipt = await this.controller.updateTokenTap(this.collaterals.dai.address, RATES[1] - 1, FLOORS[1] + 1, { from: authorized })

        assertExternalEvent(receipt, 'UpdateTappedToken(address,uint256,uint256)')
      })
    })

    context('> sender does not have UPDATE_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => this.controller.updateTokenTap(this.collaterals.dai.address, RATES[1] - 1, FLOORS[1] + 1, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region withdraw
  context('> #withdraw', () => {
    beforeEach(async () => {
      await forceSendETH(this.reserve.address, INITIAL_COLLATERAL_BALANCE / 10)
      await this.collaterals.dai.transfer(this.reserve.address, INITIAL_COLLATERAL_BALANCE / 10, { from: authorized })

      await increaseBlocks(1000)
    })

    context('> sender has WITHDRAW_ROLE', () => {
      it('it should transfer funds from reserve to beneficiary [ETH]', async () => {
        const receipt = await this.controller.withdraw(ETH, { from: authorized })

        assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
      })

      it('it should transfer funds from reserve to beneficiary [ERC20]', async () => {
        const receipt = await this.controller.withdraw(this.collaterals.dai.address, { from: authorized })

        assertExternalEvent(receipt, 'Withdraw(address,uint256)') // tap
      })
    })

    context('> sender does not have WITHDRAW_ROLE', () => {
      it('it should revert [ETH]', async () => {
        await assertRevert(() => this.controller.withdraw(ETH, { from: unauthorized }))
      })

      it('it should revert [ERC20]', async () => {
        await assertRevert(() => this.controller.withdraw(this.collaterals.dai.address, { from: unauthorized }))
      })
    })
  })
  // #endregion

  // #region token
  context('> #token', () => {
    it('it should return bonded token address', async () => {
      assert.equal(await this.controller.token(), this.token.address)
    })
  })
  // #endregion

  // #region contributionToken
  context('> #contributionToken', () => {
    it('it should return contribution token address', async () => {
      assert.equal(await this.controller.contributionToken(), this.collaterals.dai.address)
    })
  })
  // #endregion

  // #region collateralsToBeClaimed
  context('> #collateralsToBeClaimed', () => {
    beforeEach(async () => {
      await this.controller.openTrading({ from: authorized })
    })

    context('> collaterals', () => {
      it('it should return collaterals to be claimed [ETH]', async () => {
        const balance = await openAndClaimBuyOrder(this, ETH, random.amount(), { from: authorized })
        await this.controller.openSellOrder(ETH, balance, { from: authorized })
        const collateralsToBeClaimed = await this.marketMaker.collateralsToBeClaimed(ETH)

        assert.equal((await this.controller.collateralsToBeClaimed(ETH)).toNumber(), collateralsToBeClaimed.toNumber())
      })

      it('it should return collaterals to be claimed [ERC20]', async () => {
        const balance = await openAndClaimBuyOrder(this, this.collaterals.dai.address, random.amount(), { from: authorized })
        await this.controller.openSellOrder(this.collaterals.dai.address, balance, { from: authorized })
        const collateralsToBeClaimed = await this.marketMaker.collateralsToBeClaimed(this.collaterals.dai.address)

        assert.equal((await this.controller.collateralsToBeClaimed(this.collaterals.dai.address)).toNumber(), collateralsToBeClaimed.toNumber())
      })
    })

    context('> others', () => {
      it('it should return zero', async () => {
        assert.equal((await this.controller.collateralsToBeClaimed(root)).toNumber(), 0)
      })
    })
  })
  // #endregion

  // #region balanceOf
  context('> #balanceOf', () => {
    context('> reserve', () => {
      it('it should return available reserve balance [ETH]', async () => {
        await forceSendETH(this.reserve.address, INITIAL_COLLATERAL_BALANCE / 2)

        await progressToNextBatch()
        await progressToNextBatch()

        assert.equal((await this.controller.balanceOf(this.reserve.address, ETH)).toNumber(), INITIAL_COLLATERAL_BALANCE / 2 - RATES[0] * 3 * BATCH_BLOCKS)
      })

      it('it should return available reserve balance [ERC20]', async () => {
        await this.collaterals.dai.transfer(this.reserve.address, INITIAL_COLLATERAL_BALANCE, { from: authorized })

        await progressToNextBatch()
        await progressToNextBatch()

        assert.equal(
          (await this.controller.balanceOf(this.reserve.address, this.collaterals.dai.address)).toNumber(),
          INITIAL_COLLATERAL_BALANCE - RATES[1] * 3 * BATCH_BLOCKS
        )
      })
    })
    context('> others', () => {
      it('it should return balance [ETH]', async () => {
        assert.equal((await this.controller.balanceOf(authorized, ETH)).toNumber(), (await web3.eth.getBalance(authorized)).toNumber())
      })

      it('it should return balance [ETH]', async () => {
        assert.equal(
          (await this.controller.balanceOf(authorized, this.collaterals.dai.address)).toNumber(),
          (await this.collaterals.dai.balanceOf(authorized)).toNumber()
        )
      })
    })
  })
  // #endregion
})
