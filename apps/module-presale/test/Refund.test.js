const {
  FUNDING_PERIOD,
  SALE_STATE,
  DAI_FUNDING_GOAL
} = require('./common/constants')
const { daiToProjectTokens, getEvent } = require('./common/utils')
const { deployDefaultSetup } = require('./common/deploy')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const BUYERS_DAI_BALANCE = 1000

contract('Refund', ([anyone, appManager, buyer1, buyer2, buyer3, buyer4, buyer5]) => {

  let startTime

  before(async () => {
    await deployDefaultSetup(this, appManager)

    await this.daiToken.generateTokens(buyer1, BUYERS_DAI_BALANCE)
    await this.daiToken.generateTokens(buyer2, BUYERS_DAI_BALANCE)
    await this.daiToken.generateTokens(buyer3, BUYERS_DAI_BALANCE)
    await this.daiToken.generateTokens(buyer5, BUYERS_DAI_BALANCE)

    await this.daiToken.approve(this.presale.address, BUYERS_DAI_BALANCE, { from: buyer1 })
    await this.daiToken.approve(this.presale.address, BUYERS_DAI_BALANCE, { from: buyer2 })
    await this.daiToken.approve(this.presale.address, BUYERS_DAI_BALANCE, { from: buyer3 })
    await this.daiToken.approve(this.presale.address, BUYERS_DAI_BALANCE, { from: buyer5 })

    startTime = new Date().getTime() / 1000
    await this.presale.start({ from: appManager })
  })

  describe('When purchases have been made and the sale is Refunding', () => {

    before(async () => {
      // Make a few purchases, careful not to reach the funding goal.
      await this.presale.buy(BUYERS_DAI_BALANCE, { from: buyer1 }) // Spends everything in one purchase
      await this.presale.buy(BUYERS_DAI_BALANCE / 2, { from: buyer2 })
      await this.presale.buy(BUYERS_DAI_BALANCE / 2, { from: buyer2 }) // Spends everything in two purchases
      await this.presale.buy(BUYERS_DAI_BALANCE / 2, { from: buyer3 }) // Spends half
      await this.presale.buy(1, { from: buyer5 }) // Spends a miserable amount xD
      await this.presale.buy(1, { from: buyer5 }) // And again

      await this.presale.mockSetTimestamp(startTime + FUNDING_PERIOD)
    })

    it('Sale state is Refunding', async () => {
      expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.REFUNDING)
    })

    it('Buyers obtained project tokens for their dai', async () => {
      expect((await this.daiToken.balanceOf(buyer1)).toNumber()).to.equal(0)
      expect((await this.daiToken.balanceOf(buyer2)).toNumber()).to.equal(0)
      expect((await this.daiToken.balanceOf(buyer3)).toNumber()).to.equal(BUYERS_DAI_BALANCE / 2)

      expect((await this.projectToken.balanceOf(buyer1)).toNumber()).to.equal(daiToProjectTokens(BUYERS_DAI_BALANCE))
      expect((await this.projectToken.balanceOf(buyer2)).toNumber()).to.equal(daiToProjectTokens(BUYERS_DAI_BALANCE))
      expect((await this.projectToken.balanceOf(buyer3)).toNumber()).to.equal(daiToProjectTokens(BUYERS_DAI_BALANCE / 2))
    })

    it('Allows a buyer who made a single purchase to get refunded', async () => {
      await this.presale.refund(buyer1, 0)
      expect((await this.daiToken.balanceOf(buyer1)).toNumber()).to.equal(BUYERS_DAI_BALANCE)
      expect((await this.projectToken.balanceOf(buyer1)).toNumber()).to.equal(0)
    })

    it('Allows a buyer who made multiple purchases to get refunded', async () => {
      await this.presale.refund(buyer2, 0)
      await this.presale.refund(buyer2, 1)
      expect((await this.daiToken.balanceOf(buyer2)).toNumber()).to.equal(BUYERS_DAI_BALANCE)
    })

    it('A TokensRefunded event is emitted', async () => {
      const refundTx = await this.presale.refund(buyer5, 0)
      const expectedAmount = daiToProjectTokens(1)
      const event = getEvent(refundTx, 'TokensRefunded')
      expect(event).to.exist
      expect(event.args.buyer).to.equal(buyer5)
      expect(event.args.daiRefunded.toNumber()).to.equal(1)
      expect(event.args.tokensBurned.toNumber()).to.equal(expectedAmount)
      expect(event.args.purchaseId.toNumber()).to.equal(0)
    })

    it('Project tokens are burnt once refunded', async () => {
      const expectedAmount = daiToProjectTokens(1)
      const initialProjectTokenSupply = (await this.projectToken.totalSupply()).toNumber()
      await this.presale.refund(buyer5, 1)
      expect((await this.projectToken.totalSupply()).toNumber()).to.equal(initialProjectTokenSupply - expectedAmount)
    })

    it('Should deny anyone to get a refund for a purchase that wasn\'t made', async () => {
      await assertRevert(
        this.presale.refund(anyone, 0),
        'PRESALE_NOTHING_TO_REFUND'
      )
    })

    it('Should deny a buyer to get a refund for a purchase that wasn\'t made', async () => {
      await assertRevert(
        this.presale.refund(buyer2, 2),
        'PRESALE_NOTHING_TO_REFUND'
      )
    })
  })

  describe('When purchases have been made and the sale is Funding', () => {

    before(async () => {
      await this.presale.mockSetTimestamp(startTime)
    })

    it('Sale state is Funding', async () => {
      expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.FUNDING)
    })

    it('Should revert if a buyer attempts to get a refund', async () => {
      await assertRevert(
        this.presale.refund(buyer1, 0),
        'PRESALE_INVALID_STATE'
      )
    })
  })

  describe('When purchases have been made and the sale is ready to be closed', () => {

    before(async () => {
      await this.presale.mockSetTimestamp(startTime)
      await this.daiToken.generateTokens(buyer4, DAI_FUNDING_GOAL)
      await this.daiToken.approve(this.presale.address, DAI_FUNDING_GOAL, { from: buyer4 })

      const totalDaiRaised = (await this.presale.totalDaiRaised()).toNumber()
      await this.presale.buy(DAI_FUNDING_GOAL - totalDaiRaised, {  from: buyer4 })
    })

    it('Sale state is GoalReached', async () => {
      expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.GOAL_REACHED)
    })

    it('Should revert if a buyer attempts to get a refund', async () => {
      await assertRevert(
        this.presale.refund(buyer4, 0),
        'PRESALE_INVALID_STATE'
      )
    })
  })
})
