const { PRESALE_STATE, PRESALE_PERIOD, PRESALE_GOAL, ZERO_ADDRESS } = require('@ablack/fundraising-shared-test-helpers/constants')
const { sendTransaction, contributionToProjectTokens, getEvent, now } = require('./common/utils')
const { prepareDefaultSetup, defaultDeployParams, initializePresale, deployDefaultSetup } = require('./common/deploy')
const { assertRevert } = require('@aragon/test-helpers/assertThrow')

contract.only('Presale, contribute() functionality', ([anyone, appManager, buyer1, buyer2]) => {

  // TODO: This is deprecated now that Presale accepts ETH
  // describe('When using other tokens', () => {
  //   before(async () => {
  //     await deployDefaultSetup(this, appManager)
  //   })

  //   it('Does not accept ETH', async () => {
  //     await assertRevert(sendTransaction({ from: anyone, to: this.presale.address, value: web3.toWei(1, 'ether') }))
  //   })
  // })

  const initializePresaleWithERC20 = async (startDate) => {
    await this.contributionToken.generateTokens(buyer1, 100e18)
    await this.contributionToken.generateTokens(buyer2, 100000e18)
    await this.contributionToken.approve(this.presale.address, 100e18, { from: buyer1 })
    await this.contributionToken.approve(this.presale.address, 100000e18, { from: buyer2 })

    await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate })
  }

  const initializePresaleWithETH = async (startDate) => {
    this.contributionToken = {
      balanceOf: async address => new Promise(resolve => resolve(web3.eth.getBalance(address)))
    }

    await initializePresale(this, { ...defaultDeployParams(this, appManager), startDate, contributionToken: ZERO_ADDRESS })
  }

  const contribute = (sender, amount, useETH) => {
    return this.presale.contribute(sender, amount, { from: sender, value: useETH ? amount : 0 })
  }

  const itAllowsUsersToContribute = (useETH, startDate) => {
    before('Prepare app', async () => {
      await prepareDefaultSetup(this, appManager)
    })

    before('Initialize token and app', async () => {
      if (useETH) {
        await initializePresaleWithETH(startDate)
      } else {
        await initializePresaleWithERC20(startDate)
      }
    })

    it('Reverts if the user attempts to buy tokens before the sale has started', async () => {
      await assertRevert(contribute(buyer1, 1, useETH), 'PRESALE_INVALID_STATE')
    })

    describe('When the sale has started', () => {
      const contributionAmount = '100e18'

      before('Open the sale if necessary, and set the date to the open date', async () => {
        if (startDate == 0) {
          startDate = now()
          await this.presale.open({ from: appManager })
        }
        await this.presale.mockSetTimestamp(startDate + 1)
      })

      it('App state should be Funding', async () => {
        expect((await this.presale.currentPresaleState()).toNumber()).to.equal(PRESALE_STATE.FUNDING)
      })

      it('A user can query how many project tokens would be obtained for a given amount of contribution tokens', async () => {
        const reportedAmount = (await this.presale.contributionToTokens(contributionAmount)).toString()
        const expectedAmount = contributionToProjectTokens(contributionAmount).toString()
        expect(reportedAmount).to.equal(expectedAmount)
      })

      describe('When a user buys project tokens', () => {
        let purchaseTx
        let buyer1_initialBalance

        before('Record initial token balances and make a contribution', async () => {
          buyer1_initialBalance = (await this.contributionToken.balanceOf(buyer1)).toString()

          console.log(`supply before`, (await this.projectToken.totalSupply()).toString())
          console.log(`balance before`, (await this.projectToken.balanceOf(this.tokenManager.address)).toString())
          purchaseTx = await contribute(buyer1, contributionAmount, useETH)
          console.log( JSON.stringify(purchaseTx, null, 2) )
        })

        it('Mints the correct amount of project tokens', async () => {
          const expectedAmount = contributionToProjectTokens(contributionAmount).toString()
          console.log(`supply after`, (await this.projectToken.totalSupply()).toString())
          console.log(`balance after`, (await this.projectToken.balanceOf(this.tokenManager.address)).toString())
          expect((await this.projectToken.totalSupply()).toString()).to.equal(expectedAmount)
        })

        // it('Reduces user contribution token balance', async () => {
        //   const userBalance = (await this.contributionToken.balanceOf(buyer1)).toNumber()
        //   console.log(`userBalance`, userBalance)
        //   const expectedBalance = buyer1_initialBalance - contributionAmount
        //   console.log(`expectedBalance`, expectedBalance)
        //   console.log(`DELTA`, userBalance - expectedBalance)
        //   // expect(userBalance).to.be.closeTo(expectedBalance, )
        // })

        // it('Increases presale contribution token balance', async () => {
        //   const appBalance = (await this.contributionToken.balanceOf(this.presale.address)).toNumber()
        //   expect(appBalance).to.equal(contributionAmount)
        // })

        // it('Vested tokens are assigned to the buyer', async () => {
        //   const userBalance = (await this.projectToken.balanceOf(buyer1)).toNumber()
        //   const expectedAmount = contributionToProjectTokens(contributionAmount)
        //   expect(userBalance).to.equal(expectedAmount)
        // })

        // it('A Contribute event is emitted', async () => {
        //   const expectedAmount = contributionToProjectTokens(contributionAmount)
        //   const event = getEvent(purchaseTx, 'Contribute')
        //   expect(event).to.exist
        //   expect(event.args.contributor).to.equal(buyer1)
        //   expect(event.args.value.toNumber()).to.equal(contributionAmount)
        //   expect(event.args.amount.toNumber()).to.equal(expectedAmount)
        //   expect(event.args.vestedPurchaseId.toNumber()).to.equal(0)
        // })

        // it('The purchase produces a valid purchase id for the buyer', async () => {
        //   await contribute(buyer2, 1, useETH)
        //   await contribute(buyer2, 2, useETH)
        //   const tx = await contribute(buyer2, 3, useETH)
        //   const event = getEvent(tx, 'Contribute')
        //   expect(event.args.vestedPurchaseId.toNumber()).to.equal(2)
        // })

        // it('Keeps track of total tokens raised', async () => {
        //   const raised = await this.presale.totalRaised()
        //   expect(raised.toNumber()).to.equal(contributionAmount + 6)
        // })

        // it('Keeps track of independent purchases', async () => {
        //   expect((await this.presale.purchases(buyer1, 0)).toNumber()).to.equal(contributionAmount)
        //   expect((await this.presale.purchases(buyer2, 0)).toNumber()).to.equal(1)
        //   expect((await this.presale.purchases(buyer2, 1)).toNumber()).to.equal(2)
        //   expect((await this.presale.purchases(buyer2, 2)).toNumber()).to.equal(3)
        // })

        // describe('When the sale is Refunding', () => {
        //   before(async () => {
        //     await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD)
        //   })

        //   it('Sale state is Refunding', async () => {
        //     expect((await this.presale.currentPresaleState()).toNumber()).to.equal(PRESALE_STATE.REFUNDING)
        //   })

        //   it('Reverts if a user attempts to buy tokens', async () => {
        //     await assertRevert(contribute(buyer2, 1, useETH), 'PRESALE_INVALID_STATE')
        //   })
        // })

        // describe('When the sale state is GoalReached', () => {
        //   before(async () => {
        //     await this.presale.mockSetTimestamp(startDate + PRESALE_PERIOD / 2)
        //   })

        //   it('A purchase cannot cause totalRaised to be greater than the presaleGoal', async () => {
        //     const raised = (await this.presale.totalRaised()).toNumber()
        //     const remainingToFundingGoal = PRESALE_GOAL - raised
        //     const userBalanceBeforePurchase = (await this.contributionToken.balanceOf(buyer2)).toNumber()

        //     const amount = PRESALE_GOAL * 2
        //     const tx = await contribute(buyer2, amount, useETH)
        //     const userBalanceAfterPurchase = (await this.contributionToken.balanceOf(buyer2)).toNumber()

        //     const tokensUsedInPurchase = userBalanceBeforePurchase - userBalanceAfterPurchase
        //     expect(tokensUsedInPurchase).to.equal(remainingToFundingGoal)
        //   })

        //   it('Sale state is GoalReached', async () => {
        //     expect((await this.presale.currentPresaleState()).toNumber()).to.equal(PRESALE_STATE.GOAL_REACHED)
        //   })

        //   it('Reverts if a user attempts to buy tokens', async () => {
        //     await assertRevert(contribute(buyer2, 1, useETH), 'PRESALE_INVALID_STATE')
        //   })
        // })
      })
    })
  }

  // describe('When using ERC20 tokens as contribution tokens', () => {
  //   describe('When no startDate is specified upon initialization', () => {
  //     itAllowsUsersToContribute(false, 0)
  //   })

  //   describe('When a startDate is specified upon initialization', () => {
  //     itAllowsUsersToContribute(false, now() + 3600)
  //   })
  // })

  describe('When using ETH as contribution tokens', () => {
    // describe('When no startDate is specified upon initialization', () => {
    //   itAllowsUsersToContribute(true, 0)
    // })

    describe('When a startDate is specified upon initialization', () => {
      itAllowsUsersToContribute(true, now() + 3600)
    })
  })
})
