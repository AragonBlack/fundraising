const {
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD
} = require('./common/constants')
const { deployDefaultSetup } = require('./common/deploy')
const { daiToProjectTokens } = require('./common/utils')

const BUYER_DAI_BALANCE = 20000

contract('Vesting', ([anyone, appManager, buyer]) => {

  describe('When a purchase produces vested tokens', () => {

    let startDate

    let vestedAmount, vestingStartDate, vestingCliffDate, vestingCompleteDate, vestingRevokable

    before(async () => {
      await deployDefaultSetup(this, appManager)
      await this.daiToken.generateTokens(buyer, BUYER_DAI_BALANCE)
      await this.daiToken.approve(this.presale.address, BUYER_DAI_BALANCE, { from: buyer })

      startDate = Math.floor(new Date().getTime() / 1000)
      await this.presale.start({ from: appManager })

      await this.presale.buy(BUYER_DAI_BALANCE, { from: buyer })

      const vestingData = await this.tokenManager.getVesting(buyer, 0)
      vestedAmount = vestingData[0]
      vestingStartDate = vestingData[1]
      vestingCliffDate = vestingData[2]
      vestingCompleteDate = vestingData[3]
      vestingRevokable = vestingData[4]
    })

    it('Token manager registers the correct vested amount', async () => {
      const expectedAmount = daiToProjectTokens(BUYER_DAI_BALANCE)
      expect(vestedAmount.toNumber()).to.equal(expectedAmount)
    })

    it('Token manager registers the correct vesting start date', async () => {
      expect(vestingStartDate.toNumber()).to.equal(startDate)
    })

    it('Token manager registers the correct vesting cliff date', async () => {
      const cliffDate = startDate + VESTING_CLIFF_PERIOD
      expect(vestingCliffDate.toNumber()).to.equal(cliffDate)
    })

    it('Token manager registers the correct vesting complete date', async () => {
      const completeDate = startDate + VESTING_COMPLETE_PERIOD
      expect(vestingCompleteDate.toNumber()).to.equal(completeDate)
    })

    it('Token manager registers the vestings as revokable', async () => {
      expect(vestingRevokable).to.equal(true)
    })
  })
})
