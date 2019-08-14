const {
  SALE_STATE,
  FUNDING_PERIOD,
  FUNDING_GOAL
} = require('./common/constants')
const {
  sendTransaction,
  contributionToProjectTokens,
  getEvent,
  now
} = require('./common/utils')
const {
  prepareDefaultSetup,
  defaultDeployParams,
  initializePresale,
  deployDefaultSetup
} = require('./common/deploy')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

const BUYER_1_BALANCE = 100
const BUYER_2_BALANCE = 100000

contract('Presale, buy() functionality', ([anyone, appManager, buyer1, buyer2]) => {

  describe('When using other tokens', () => {

    before(async () => {
      await deployDefaultSetup(this, appManager)
    })

    it('Does not accept ETH', async () => {
      await assertRevert(
        sendTransaction({ from: anyone, to: this.presale.address, value: web3.toWei(1, 'ether') })
      )
    })

  })

  describe('When using contribution tokens', () => {

    const itAllowsUsersToBuyTokens = (startDate) => {

      before(async () => {
        await prepareDefaultSetup(this, appManager)
        await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })

        await this.contributionToken.generateTokens(buyer1, BUYER_1_BALANCE)
        await this.contributionToken.generateTokens(buyer2, BUYER_2_BALANCE)
        await this.contributionToken.approve(this.presale.address, BUYER_1_BALANCE, { from: buyer1 })
        await this.contributionToken.approve(this.presale.address, BUYER_2_BALANCE, { from: buyer2 })
      })

      it('Reverts if the user attempts to buy tokens before the sale has started', async () => {
        await assertRevert(
          this.presale.buy(BUYER_1_BALANCE, { from: buyer1 }),
          'PRESALE_INVALID_STATE'
        )
      })

      describe('When the sale has started', () => {

        before(async () => {
          if (startDate == 0) {
            startDate = now()
            await this.presale.start({ from: appManager })
          }
          await this.presale.mockSetTimestamp(startDate + 1)
        })

        it('App state should be Funding', async () => {
          expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.FUNDING)
        })

        it('A user can query how many project tokens would be obtained for a given amount of contribution tokens', async () => {
          const amount = (await this.presale.contributionToProjectTokens(BUYER_1_BALANCE)).toNumber()
          const expectedAmount = contributionToProjectTokens(BUYER_1_BALANCE)
          expect(amount).to.equal(expectedAmount)
        })

        describe('When a user buys project tokens', () => {

          let purchaseTx;
          let initialProjectTokenSupply

          before(async () => {
            initialProjectTokenSupply = (await this.projectToken.totalSupply()).toNumber()
            purchaseTx = await this.presale.buy(BUYER_1_BALANCE, { from: buyer1 })
          })

          it('Project tokens are minted on purchases', async () => {
            const expectedAmount = contributionToProjectTokens(BUYER_1_BALANCE)
            expect((await this.projectToken.totalSupply()).toNumber()).to.equal(initialProjectTokenSupply + expectedAmount)
          })

          it('The tokens are transferred from the buyer to the app', async () => {
            const userBalance = (await this.contributionToken.balanceOf(buyer1)).toNumber()
            const appBalance = (await this.contributionToken.balanceOf(this.presale.address)).toNumber()
            expect(userBalance).to.equal(0)
            expect(appBalance).to.equal(BUYER_1_BALANCE)
          })

          it('Vested tokens are assigned to the buyer', async () => {
            const userBalance = (await this.projectToken.balanceOf(buyer1)).toNumber()
            const expectedAmount = contributionToProjectTokens(BUYER_1_BALANCE)
            expect(userBalance).to.equal(expectedAmount)
          })

          it('A TokensPurchased event is emitted', async () => {
            const expectedAmount = contributionToProjectTokens(BUYER_1_BALANCE)
            const event = getEvent(purchaseTx, 'TokensPurchased')
            expect(event).to.exist
            expect(event.args.buyer).to.equal(buyer1)
            expect(event.args.tokensSpent.toNumber()).to.equal(BUYER_1_BALANCE)
            expect(event.args.tokensPurchased.toNumber()).to.equal(expectedAmount)
            expect(event.args.vestedPurchaseId.toNumber()).to.equal(0)
          })

          it('The purchase produces a valid purchase id for the buyer', async () => {
            await this.presale.buy(1, { from: buyer2 })
            await this.presale.buy(2, { from: buyer2 })
            const tx = await this.presale.buy(3, { from: buyer2 })
            const event = getEvent(tx, 'TokensPurchased')
            expect(event.args.vestedPurchaseId.toNumber()).to.equal(2)
          })

          it('Keeps track of total tokens raised', async () => {
            const raised = await this.presale.totalRaised()
            expect(raised.toNumber()).to.equal(BUYER_1_BALANCE + 6)
          })

          it('Keeps track of independent purchases', async () => {
            expect((await this.presale.purchases(buyer1, 0)).toNumber()).to.equal(BUYER_1_BALANCE)
            expect((await this.presale.purchases(buyer2, 0)).toNumber()).to.equal(1)
            expect((await this.presale.purchases(buyer2, 1)).toNumber()).to.equal(2)
            expect((await this.presale.purchases(buyer2, 2)).toNumber()).to.equal(3)
          })

          describe('When the sale is Refunding', () => {

            before(async () => {
              await this.presale.mockSetTimestamp(startDate + FUNDING_PERIOD)
            })

            it('Sale state is Refunding', async () => {
              expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.REFUNDING)
            })

            it('Reverts if a user attempts to buy tokens', async () => {
              await assertRevert(
                this.presale.buy(1, { from: buyer2 }),
                'PRESALE_INVALID_STATE'
              )
            })
          })

          describe('When the sale state is GoalReached', () => {

            before(async () => {
              await this.presale.mockSetTimestamp(startDate + FUNDING_PERIOD / 2)
            })

            it('A purchase cannot cause totalRaised to be greater than the fundingGoal', async () => {
              const raised = (await this.presale.totalRaised()).toNumber()
              const remainingToFundingGoal = FUNDING_GOAL - raised
              const userBalanceBeforePurchase = (await this.contributionToken.balanceOf(buyer2))
              await this.presale.buy(FUNDING_GOAL * 2, { from: buyer2 })
              const userBalanceAfterPurchase = (await this.contributionToken.balanceOf(buyer2))
              const tokensUsedInPurchase = userBalanceBeforePurchase - userBalanceAfterPurchase
              expect(tokensUsedInPurchase).to.equal(remainingToFundingGoal)
            })

            it('Sale state is GoalReached', async () => {
              expect((await this.presale.currentSaleState()).toNumber()).to.equal(SALE_STATE.GOAL_REACHED)
            })

            it('Reverts if a user attempts to buy tokens', async () => {
              await assertRevert(
                this.presale.buy(1, { from: buyer2 }),
                'PRESALE_INVALID_STATE'
              )
            })
          })
        })
      })
    }

    describe('When no startDate is specified upon initialization', () => {
      itAllowsUsersToBuyTokens(0)
    })

    describe('When a startDate is specified upon initialization', () => {
      itAllowsUsersToBuyTokens(now() + 3600)
    })
  })
})
