const { PRESALE_PERIOD, SALE_STATE, CONNECTOR_WEIGHT, TAP_RATE, PERCENT_FUNDING_FOR_BENEFICIARY, PPM } = require('./common/constants')
const { prepareDefaultSetup, defaultDeployParams, initializePresale } = require('./common/deploy')
const { getEvent, now } = require('./common/utils')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const assertExternalEvent = require('@ablack/fundraising-shared-test-helpers/assertExternalEvent')

const BUYER_BALANCE = 20000

contract.only('Presale, close() functionality', ([anyone, appManager, buyer1]) => {
  const itAllowsTheSaleToBeClosed = startDate => {
    describe('When enough purchases have been made to close the sale', () => {
      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(buyer1, BUYER_BALANCE)
        await this.contributionToken.approve(this.presale.address, BUYER_BALANCE, { from: buyer1 })

        if (startDate == 0) {
          startDate = now()
          await this.presale.open({ from: appManager })
        }
        await this.presale.mockSetTimestamp(startDate + 1)

        // Make a single purchase that reaches the funding goal
        await this.presale.contribute(buyer1, BUYER_BALANCE)
      })

      it('Sale state is GoalReached', async () => {
        expect((await this.presale.currentPresaleState()).toNumber()).to.equal(SALE_STATE.GOAL_REACHED)
      })

      describe('When the sale is closed', () => {
        let closeReceipt

        before(async () => {
          closeReceipt = await this.presale.close()
        })

        it('Sale state is Closed', async () => {
          expect((await this.presale.currentPresaleState()).toNumber()).to.equal(SALE_STATE.CLOSED)
        })

        it('Raised funds are transferred to the fundraising reserve and the beneficiary address', async () => {
          expect((await this.contributionToken.balanceOf(this.presale.address)).toNumber()).to.equal(0)

          const totalRaised = (await this.presale.totalRaised()).toNumber()
          const tokensForBeneficiary = Math.floor((totalRaised * PERCENT_FUNDING_FOR_BENEFICIARY) / PPM)
          const tokensForReserve = totalRaised - tokensForBeneficiary
          const reserve = await this.presale.reserve()
          expect((await this.contributionToken.balanceOf(appManager)).toNumber()).to.equal(tokensForBeneficiary)
          expect((await this.contributionToken.balanceOf(reserve)).toNumber()).to.equal(tokensForReserve)
        })

        it.only('Collaterals tap timestamps are reset', async () => {
          assertExternalEvent(closeReceipt, 'ResetTappedToken(address)', 2)
        })

        it('Continuous fundraising campaign is started', async () => {
          expect(await this.fundraising.continuousCampaignIsStarted()).to.equal(true)
        })

        it('Sale cannot be closed again', async () => {
          await assertRevert(this.presale.close(), 'PRESALE_INVALID_STATE')
        })

        it('Emitted a SaleClosed event', async () => {
          expect(getEvent(closeReceipt, 'PresaleClosed')).to.exist
        })
      })
    })
  }

  describe('When no startDate is specified upon initialization', () => {
    itAllowsTheSaleToBeClosed(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itAllowsTheSaleToBeClosed(now() + 3600)
  })
})
