const {
  FUNDING_PERIOD,
  DAI_FUNDING_GOAL,
  SALE_STATE
} = require('./common/constants')
const { deployDefaultSetup } = require('./common/deploy')
const { getEvent } = require('./common/utils')

const getState = async (test) => {
  return (await test.presale.currentSaleState()).toNumber()
}

contract('States', ([anyone, appManager, buyer]) => {

  describe('When a sale is deployed', () => {

    before(async () => {
      await deployDefaultSetup(this, appManager)
      await this.daiToken.generateTokens(buyer, DAI_FUNDING_GOAL)
      await this.daiToken.approve(this.presale.address, DAI_FUNDING_GOAL, { from: buyer })
    })

    it('Initial state is Pending', async () => {
      expect(await getState(this)).to.equal(SALE_STATE.PENDING)
    })

    describe('When the sale is started', () => {

      let startDate
      let startReceipt

      before(async () => {
        startDate = new Date().getTime() / 1000
        startReceipt = await this.presale.start({ from: appManager })
      })

      it('The state is Funding', async () => {
        expect(await getState(this)).to.equal(SALE_STATE.FUNDING)
      })

      it('A SaleStarted event is triggered', async () => {
        expect(getEvent(startReceipt, 'SaleStarted')).to.exist
      })

      describe('When the funding period is still running', () => {

        before(async () => {
          await this.presale.mockSetTimestamp(startDate + FUNDING_PERIOD / 2)
        })

        it('The state is still Funding', async () => {
          expect(await getState(this)).to.equal(SALE_STATE.FUNDING)
        })

        describe('When purchases are made, not reaching the funding goal', () => {

          before(async () => {
            await this.presale.buy(DAI_FUNDING_GOAL / 2, { from: buyer })
          })

          it('The state is still Funding', async () => {
            expect(await getState(this)).to.equal(SALE_STATE.FUNDING)
          })

          describe('When the funding period elapses without having reached the funding goal', () => {

            before(async () => {
              await this.presale.mockSetTimestamp(startDate + FUNDING_PERIOD)
            })

            it('The state is Refunding', async () => {
              expect(await getState(this)).to.equal(SALE_STATE.REFUNDING)
            })
          })
        })

        describe('When purchases are made, reaching the funding goal before the funding period elapsed', () => {

          before(async () => {
            await this.presale.mockSetTimestamp(startDate + FUNDING_PERIOD / 2)
            await this.presale.buy(DAI_FUNDING_GOAL / 2, { from: buyer })
          })

          it('The state is GoalReached', async () => {
            expect(await getState(this)).to.equal(SALE_STATE.GOAL_REACHED)
          })

          describe('When the funding period elapses having reached the funding goal', () => {

            before(async () => {
              await this.presale.mockSetTimestamp(startDate + FUNDING_PERIOD)
            })

            it('The state is still GoalReached', async () => {
              expect(await getState(this)).to.equal(SALE_STATE.GOAL_REACHED)
            })
          })

          describe('When the sale owner closes the sale', () => {

            before(async () => {
              await this.presale.close()
            })

            it('The state is Closed', async () => {
              expect(await getState(this)).to.equal(SALE_STATE.CLOSED)
            })
          })
        })
      })
    })
  })
})
