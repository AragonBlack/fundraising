const {
  PRESALE_GOAL,
  PERCENT_SUPPLY_OFFERED,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PRESALE_STATE,
  CONNECTOR_WEIGHT,
  TAP_RATE,
  PRESALE_PERIOD,
  ZERO_ADDRESS,
  PERCENT_FUNDING_FOR_BENEFICIARY,
} = require('@ablack/fundraising-shared-test-helpers/constants')
const { prepareDefaultSetup, initializePresale, defaultDeployParams } = require('./common/deploy')
const { tokenExchangeRate, now } = require('./common/utils')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

contract('Presale, setup', ([anyone, appManager, someEOA]) => {
  describe('When deploying the app with valid parameters', () => {
    const itSetupsTheAppCorrectly = startDate => {
      let presaleInitializationTx

      before(async () => {
        await prepareDefaultSetup(this, appManager)
        presaleInitializationTx = await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })
      })

      it('App gets deployed', async () => {
        expect(web3.isAddress(this.presale.address)).to.equal(true)
      })

      it('Gas used is ~3.38e6', async () => {
        const gasUsed = presaleInitializationTx.receipt.gasUsed
        expect(gasUsed).to.be.below(3.38e6)
      })

      it('Deploys fundraising related apps', async () => {
        expect(web3.isAddress(this.reserve.address)).to.equal(true)
      })

      it('Controller is set', async () => {
        expect(await this.presale.controller()).to.equal(this.fundraising.address)
      })

      it('startDate is set correctly', async () => {
        expect((await this.presale.openDate()).toNumber()).to.equal(startDate)
      })

      it('Funding goal and percentage offered are set', async () => {
        expect((await this.presale.goal()).toNumber()).to.equal(Number(PRESALE_GOAL))
        expect((await this.presale.supplyOfferedPct()).toNumber()).to.equal(PERCENT_SUPPLY_OFFERED)
      })

      it('Dates and time periods are set', async () => {
        expect((await this.presale.vestingCliffPeriod()).toNumber()).to.equal(VESTING_CLIFF_PERIOD)
        expect((await this.presale.vestingCompletePeriod()).toNumber()).to.equal(VESTING_COMPLETE_PERIOD)
        expect((await this.presale.period()).toNumber()).to.equal(PRESALE_PERIOD)
      })

      it('Initial state is Pending', async () => {
        expect((await this.presale.state()).toNumber()).to.equal(PRESALE_STATE.PENDING)
      })

      it('Project token is deployed and set in the app', async () => {
        expect(web3.isAddress(this.projectToken.address)).to.equal(true)
        expect(await this.presale.token()).to.equal(this.projectToken.address)
      })

      it('Contribution token is deployed and set in the app', async () => {
        expect(web3.isAddress(this.contributionToken.address)).to.equal(true)
        expect(await this.presale.contributionToken()).to.equal(this.contributionToken.address)
      })

      it('TokenManager is deployed, set in the app, and controls the project token', async () => {
        expect(web3.isAddress(this.tokenManager.address)).to.equal(true)
        expect(await this.presale.tokenManager()).to.equal(this.tokenManager.address)
      })

      it('Exchange rate is calculated to the expected value', async () => {
        const receivedValue = (await this.presale.exchangeRate()).toNumber()
        const expectedValue = tokenExchangeRate()
        expect(receivedValue).to.equal(expectedValue)
      })

      it('Beneficiary address is set', async () => {
        expect(await this.presale.beneficiary()).to.equal(appManager)
      })

      it('Percent funding for beneficiary is set', async () => {
        expect((await this.presale.fundingForBeneficiaryPct()).toNumber()).to.equal(PERCENT_FUNDING_FOR_BENEFICIARY)
      })
    }

    describe('When no startDate is specified upon initialization', () => {
      itSetupsTheAppCorrectly(0)
    })

    describe('When a startDate is specified upon initialization', () => {
      itSetupsTheAppCorrectly(now() + 3600)
    })
  })

  describe('When deploying the app with invalid parameters', () => {
    let defaultParams

    before(async () => {
      await prepareDefaultSetup(this, appManager)
      defaultParams = defaultDeployParams(this, appManager)
    })

    it('Reverts when setting an invalid contribution token', async () => {
      await assertRevert(initializePresale(this, { ...defaultParams, contributionToken: someEOA }), 'PRESALE_INVALID_CONTRIBUTE_TOKEN')
    })

    it('Reverts when setting an invalid reserve', async () => {
      await assertRevert(initializePresale(this, { ...defaultParams, reserve: someEOA }), 'PRESALE_CONTRACT_IS_EOA')
    })

    it('Reverts when setting invalid dates', async () => {
      await assertRevert(initializePresale(this, { ...defaultParams, startDate: Math.floor(new Date().getTime() / 1000) - 1 }), 'PRESALE_INVALID_TIME_PERIOD')
      await assertRevert(initializePresale(this, { ...defaultParams, presalePeriod: 0 }), 'PRESALE_INVALID_TIME_PERIOD')
      await assertRevert(initializePresale(this, { ...defaultParams, vestingCliffPeriod: defaultParams.presalePeriod - 1 }), 'PRESALE_INVALID_TIME_PERIOD')
      await assertRevert(
        initializePresale(this, { ...defaultParams, vestingCompletePeriod: defaultParams.vestingCliffPeriod - 1 }),
        'PRESALE_INVALID_TIME_PERIOD'
      )
    })

    it('Reverts when setting an invalid funding goal', async () => {
      await assertRevert(initializePresale(this, { ...defaultParams, presaleGoal: 0 }), 'PRESALE_INVALID_GOAL')
    })

    it('Reverts when setting an invalid percent supply offered', async () => {
      await assertRevert(initializePresale(this, { ...defaultParams, percentSupplyOffered: 0 }), 'PRESALE_INVALID_PCT')
      await assertRevert(initializePresale(this, { ...defaultParams, percentSupplyOffered: 1e6 + 1 }), 'PRESALE_INVALID_PCT')
    })

    it('Reverts when setting an invalid percent funding for beneficiary', async () => {
      await assertRevert(initializePresale(this, { ...defaultParams, percentFundingForBeneficiary: 1e6 + 1 }), 'PRESALE_INVALID_PCT')
    })

    it('Reverts when setting an invalid beneficiary address', async () => {
      initializePresale(this, { ...defaultParams, beneficiary: ZERO_ADDRESS }), 'PRESALE_INVALID_BENEFIC_ADDRESS'
    })
  })
})
