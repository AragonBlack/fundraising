const { PRESALE_PERIOD, PRESALE_GOAL, SALE_STATE } = require('./common/constants')
const { prepareDefaultSetup, defaultDeployParams, initializePresale } = require('./common/deploy')
const { getEvent, now } = require('./common/utils')

const getState = async test => {
  return (await test.presale.currentPresaleState()).toNumber()
}

contract('Presale, states validation', ([anyone, appManager, buyer]) => {
  const itManagesStateCorrectly = startDate => {
    describe('When a sale is deployed', () => {
      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(buyer, PRESALE_GOAL)
        await this.contributionToken.approve(this.presale.address, PRESALE_GOAL, { from: buyer })
      })

      it('Initial state is Pending', async () => {
        expect(await getState(this)).to.equal(SALE_STATE.PENDING)
      })

      describe('When the sale is started', () => {
        before(async () => {
          if (startDate == 0) {
            startDate = now()
            await this.presale.start({ from: appManager })
          }
          await this.presale.mockSetTimestamp(startDate + 1)
        })

        it('The state is Funding', async () => {
          expect(await getState(this)).to.equal(SALE_STATE.FUNDING)
        })

        describe('When the funding period is still running', () => {
          before(async () => {
            await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD / 2)
          })

          it('The state is still Funding', async () => {
            expect(await getState(this)).to.equal(SALE_STATE.FUNDING)
          })

          describe('When purchases are made, not reaching the funding goal', () => {
            before(async () => {
              await this.presale.buy(PRESALE_GOAL / 2, { from: buyer })
            })

            it('The state is still Funding', async () => {
              expect(await getState(this)).to.equal(SALE_STATE.FUNDING)
            })

            describe('When the funding period elapses without having reached the funding goal', () => {
              before(async () => {
                await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD)
              })

              it('The state is Refunding', async () => {
                expect(await getState(this)).to.equal(SALE_STATE.REFUNDING)
              })
            })
          })

          describe('When purchases are made, reaching the funding goal before the funding period elapsed', () => {
            before(async () => {
              await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD / 2)
              await this.presale.buy(PRESALE_GOAL / 2, { from: buyer })
            })

            it('The state is GoalReached', async () => {
              expect(await getState(this)).to.equal(SALE_STATE.GOAL_REACHED)
            })

            describe('When the funding period elapses having reached the funding goal', () => {
              before(async () => {
                await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD)
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
  }

  describe('When no startDate is specified upon initialization', () => {
    itManagesStateCorrectly(0)
  })

  describe('When a startDate is specified upon initialization', () => {
    itManagesStateCorrectly(now() + 3600)
  })
})
