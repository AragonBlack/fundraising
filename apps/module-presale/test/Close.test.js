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

const BUYERS_DAI_BALANCE = 20000

contract('Close', ([anyone, appManager, buyer1]) => {

  describe('When enough purchases have been made to close the sale', () => {

    before(async () => {
      await deployDefaultSetup(this, appManager)
      await this.daiToken.generateTokens(buyer1, BUYERS_DAI_BALANCE)
      await this.daiToken.approve(this.presale.address, BUYERS_DAI_BALANCE, { from: buyer1 })
      await this.presale.start({ from: appManager })

      // Make a single purchase that reaches the funding goal
      await this.presale.buy(BUYERS_DAI_BALANCE, { from: buyer1 })
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
        expect((await this.daiToken.balanceOf(this.presale.address)).toNumber()).to.equal(0)

        const totalDaiRaised = (await this.presale.totalDaiRaised()).toNumber()
        const daiForBeneficiary = Math.floor(totalDaiRaised * PERCENT_FUNDING_FOR_BENEFICIARY / PPM)
        const daiForPool = totalDaiRaised - daiForBeneficiary
        const fundraisingPool = await this.presale.fundraisingPool()
        expect((await this.daiToken.balanceOf(appManager)).toNumber()).to.equal(daiForBeneficiary)
        expect((await this.daiToken.balanceOf(fundraisingPool)).toNumber()).to.equal(daiForPool)
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
