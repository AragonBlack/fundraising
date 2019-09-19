const { VESTING_CLIFF_PERIOD, VESTING_COMPLETE_PERIOD } = require('@ablack/fundraising-shared-test-helpers/constants')
const { prepareDefaultSetup, defaultDeployParams, initializePresale } = require('./common/deploy')
const { contributionToProjectTokens, now } = require('./common/utils')

const BUYER_BALANCE = 20000

contract('Presale, vesting functionality', ([anyone, appManager, buyer]) => {
  const itVestsTokensCorrectly = startDate => {
    describe('When a purchase produces vested tokens', () => {
      let vestedAmount, vestingStartDate, vestingCliffDate, vestingCompleteDate, vestingRevokable

      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(buyer, BUYER_BALANCE)
        await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer })

        if (startDate == 0) {
          startDate = now()
          await this.presale.open({ from: appManager })
        }
        await this.presale.mockSetTimestamp(startDate + 1)

        await this.presale.contribute(buyer, BUYER_BALANCE, { from: buyer })

        const vestingData = await this.tokenManager.getVesting(buyer, 0)
        vestedAmount = vestingData[0]
        vestingStartDate = vestingData[1]
        vestingCliffDate = vestingData[2]
        vestingCompleteDate = vestingData[3]
        vestingRevokable = vestingData[4]
      })

      it('Token manager registers the correct vested amount', async () => {
        const expectedAmount = contributionToProjectTokens(BUYER_BALANCE)
        expect(vestedAmount.toNumber()).to.equal(expectedAmount.toNumber())
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
  }

  describe('When no startDate is specified upon initialization', () => {
    itVestsTokensCorrectly(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itVestsTokensCorrectly(now() + 3600)
  })
})
