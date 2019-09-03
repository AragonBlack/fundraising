const {
  PRESALE_PERIOD,
  SALE_STATE,
  PRESALE_GOAL
} = require('./common/constants')
const { contributionToProjectTokens, getEvent, now } = require('./common/utils')
const { prepareDefaultSetup, defaultDeployParams, initializePresale } = require('./common/deploy')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const BUYER_BALANCE = 1000

contract('Presale, refund() functionality', ([anyone, appManager, buyer1, buyer2, buyer3, buyer4, buyer5]) => {

  const itAllowsBuyersToGetRefunded = (startDate) => {

    before(async () => {
      await prepareDefaultSetup(this, appManager)
      await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })

      await this.contributionToken.generateTokens(buyer1, BUYER_BALANCE)
      await this.contributionToken.generateTokens(buyer2, BUYER_BALANCE)
      await this.contributionToken.generateTokens(buyer3, BUYER_BALANCE)
      await this.contributionToken.generateTokens(buyer5, BUYER_BALANCE)

      await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer1 })
      await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer2 })
      await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer3 })
      await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer5 })

      if (startDate == 0) {
        startDate = now()
        await this.presale.start({ from: appManager })
      }
      await this.presale.mockSetTimestamp(startDate + 1)
    })

    describe('When purchases have been made and the sale is Refunding', () => {

      before(async () => {
        // Make a few purchases, careful not to reach the funding goal.
        await this.presale.buy(BUYER_BALANCE, { from: buyer1 }) // Spends everything in one purchase
        await this.presale.buy(BUYER_BALANCE / 2, { from: buyer2 })
        await this.presale.buy(BUYER_BALANCE / 2, { from: buyer2 }) // Spends everything in two purchases
        await this.presale.buy(BUYER_BALANCE / 2, { from: buyer3 }) // Spends half
        await this.presale.buy(1, { from: buyer5 }) // Spends a miserable amount xD
        await this.presale.buy(1, { from: buyer5 }) // And again

        await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD)
      })

      it('Sale state is Refunding', async () => {
        expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.REFUNDING)
      })

      it('Buyers obtained project tokens for their contribution tokens', async () => {
        expect((await this.contributionToken.balanceOf(buyer1)).toNumber()).to.equal(0)
        expect((await this.contributionToken.balanceOf(buyer2)).toNumber()).to.equal(0)
        expect((await this.contributionToken.balanceOf(buyer3)).toNumber()).to.equal(BUYER_BALANCE / 2)

        expect((await this.projectToken.balanceOf(buyer1)).toNumber()).to.equal(contributionToProjectTokens(BUYER_BALANCE))
        expect((await this.projectToken.balanceOf(buyer2)).toNumber()).to.equal(contributionToProjectTokens(BUYER_BALANCE))
        expect((await this.projectToken.balanceOf(buyer3)).toNumber()).to.equal(contributionToProjectTokens(BUYER_BALANCE / 2))
      })

      it('Allows a buyer who made a single purchase to get refunded', async () => {
        await this.presale.refund(buyer1, 0)
        expect((await this.contributionToken.balanceOf(buyer1)).toNumber()).to.equal(BUYER_BALANCE)
        expect((await this.projectToken.balanceOf(buyer1)).toNumber()).to.equal(0)
      })

      it('Allows a buyer who made multiple purchases to get refunded', async () => {
        await this.presale.refund(buyer2, 0)
        await this.presale.refund(buyer2, 1)
        expect((await this.contributionToken.balanceOf(buyer2)).toNumber()).to.equal(BUYER_BALANCE)
      })

      it('A TokensRefunded event is emitted', async () => {
        const refundTx = await this.presale.refund(buyer5, 0)
        const expectedAmount = contributionToProjectTokens(1)
        const event = getEvent(refundTx, 'TokensRefunded')
        expect(event).to.exist
        expect(event.args.buyer).to.equal(buyer5)
        expect(event.args.tokensRefunded.toNumber()).to.equal(1)
        expect(event.args.tokensBurned.toNumber()).to.equal(expectedAmount)
        expect(event.args.vestedPurchaseId.toNumber()).to.equal(0)
      })

      it('Project tokens are burnt once refunded', async () => {
        const expectedAmount = contributionToProjectTokens(1)
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
        await this.presale.mockSetTimestamp(startDate)
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
        await this.presale.mockSetTimestamp(startDate)
        await this.contributionToken.generateTokens(buyer4, PRESALE_GOAL)
        await this.contributionToken.approve(this.presale.address, PRESALE_GOAL, { from: buyer4 })

        const totalRaised = (await this.presale.totalRaised()).toNumber()
        await this.presale.buy(PRESALE_GOAL - totalRaised, {  from: buyer4 })
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
  }

  describe('When no startDate is specified upon initialization', () => {
    itAllowsBuyersToGetRefunded(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itAllowsBuyersToGetRefunded(now() + 3600)
  })
})
