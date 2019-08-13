const {
  FUNDING_PERIOD,
  SALE_STATE,
  CONNECTOR_WEIGHT,
  TAP_RATE,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  PPM
} = require('./common/constants')
const { deployDefaultSetup } = require('./common/deploy')
const { getEvent } = require('./common/utils')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const BUYER_BALANCE = 20000

contract('Close', ([anyone, appManager, buyer1]) => {

  describe('When enough purchases have been made to close the sale', () => {

    before(async () => {
      await deployDefaultSetup(this, appManager)
      await this.contributionToken.generateTokens(buyer1, BUYER_BALANCE)
      await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer1 })
      await this.presale.start({ from: appManager })

      // Make a single purchase that reaches the funding goal
      await this.presale.buy(BUYER_BALANCE, { from: buyer1 })
    })

    it('Sale state is GoalReached', async () => {
      expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.GOAL_REACHED)
    })

    describe('When the sale is closed', () => {

      let closeReceipt

      before(async () => {
        closeReceipt = await this.presale.close()
      })

      it('Sale state is Closed', async () => {
        expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.CLOSED)
      })

      it('Raised funds are transferred to the fundraising pool and the beneficiary address', async () => {
        expect((await this.contributionToken.balanceOf(this.presale.address)).toNumber()).to.equal(0)

        const totalRaised = (await this.presale.totalRaised()).toNumber()
        const tokensForBeneficiary = Math.floor(totalRaised * PERCENT_FUNDING_FOR_BENEFICIARY / PPM)
        const tokensForPool = totalRaised - tokensForBeneficiary
        const fundraisingPool = await this.presale.fundraisingPool()
        expect((await this.contributionToken.balanceOf(appManager)).toNumber()).to.equal(tokensForBeneficiary)
        expect((await this.contributionToken.balanceOf(fundraisingPool)).toNumber()).to.equal(tokensForPool)
      })

      it('Sale cannot be closed again', async () => {
        await assertRevert(
          this.presale.close(),
          'PRESALE_INVALID_STATE'
        )
      })

      it('Emitted a SaleClosed event', async () => {
        expect(getEvent(closeReceipt, 'SaleClosed')).to.exist
      })
    })
  })
})
