const { hash: namehash } = require('eth-ens-namehash')
const { randomId } = require('@aragon/templates-shared/helpers/aragonId')
const assertRevert = require('@aragon/templates-shared/helpers/assertRevert')(web3)
const { assertRole, assertMissingRole } = require('@aragon/templates-shared/helpers/assertRole')(web3)
const { deployedAddresses } = require('@aragon/templates-shared/lib/arapp-file')(web3)
const { getEventArgument } = require('@aragon/test-helpers/events')

const ACL = artifacts.require('ACL')
const Agent = artifacts.require('Agent')
const Controller = artifacts.require('AragonFundraisingController')
const ENS = artifacts.require('ENS')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const Finance = artifacts.require('Finance')
const Kernel = artifacts.require('Kernel')
const MarketMaker = artifacts.require('BatchedBancorMarketMaker')
const MiniMeToken = artifacts.require('MiniMeToken')
const Presale = artifacts.require('Presale')
const PublicResolver = artifacts.require('PublicResolver')
const Tap = artifacts.require('Tap')
const Template = artifacts.require('FundraisingMultisigTemplate')
const TokenManager = artifacts.require('TokenManager')
const TokenMock = artifacts.require('TokenMock')
const Vault = artifacts.require('Vault')
const Voting = artifacts.require('Voting')

const { APP_IDS, getInstalledAppsById } = require('./helpers/utils')
const {
  ZERO_ADDRESS,
  DAYS,
  WEEKS,
  MONTHS,
  PRESALE_GOAL,
  PRESALE_PERIOD,
  PRESALE_EXCHANGE_RATE,
  VESTING_CLIFF_PERIOD,
  VESTING_COMPLETE_PERIOD,
  PERCENT_SUPPLY_OFFERED,
  PERCENT_FUNDING_FOR_BENEFICIARY,
  VIRTUAL_SUPPLIES,
  VIRTUAL_BALANCES,
  RESERVE_RATIOS,
  SLIPPAGES,
  RATES,
  FLOORS,
  BATCH_BLOCKS,
  MAXIMUM_TAP_RATE_INCREASE_PCT,
  MAXIMUM_TAP_FLOOR_DECREASE_PCT,
} = require('@ablack/fundraising-shared-test-helpers/constants')
const ANY_ADDRESS = { address: require('@ablack/fundraising-shared-test-helpers/constants').ANY_ADDRESS }
const START_DATE = new Date().getTime() + MONTHS

contract('Fundraising with multisig', ([_, owner, boardMember1, boardMember2]) => {
  let daoID, template, dao, acl, ens, feed
  let shareVoting, boardVoting, boardTokenManager, shareTokenManager, boardToken, shareToken, finance, vault, reserve, presale, marketMaker, tap, controller
  let COLLATERALS

  const BOARD_MEMBERS = [boardMember1, boardMember2]

  const BOARD_TOKEN_NAME = 'Board Token'
  const BOARD_TOKEN_SYMBOL = 'BOARD'

  const SHARE_TOKEN_NAME = 'Share Token'
  const SHARE_TOKEN_SYMBOL = 'SHARE'

  const BOARD_VOTE_DURATION = WEEKS
  const BOARD_SUPPORT_REQUIRED = 50e16
  const BOARD_MIN_ACCEPTANCE_QUORUM = 40e16
  const BOARD_VOTING_SETTINGS = [BOARD_SUPPORT_REQUIRED, BOARD_MIN_ACCEPTANCE_QUORUM, BOARD_VOTE_DURATION]

  const SHARE_VOTE_DURATION = WEEKS
  const SHARE_SUPPORT_REQUIRED = 50e16
  const SHARE_MIN_ACCEPTANCE_QUORUM = 5e16
  const SHARE_VOTING_SETTINGS = [SHARE_SUPPORT_REQUIRED, SHARE_MIN_ACCEPTANCE_QUORUM, SHARE_VOTE_DURATION]

  before('fetch fundraising multisig template and ENS', async () => {
    const { registry, address } = await deployedAddresses()
    ens = ENS.at(registry)
    template = Template.at(address)
  })

  before('fetch collateral tokens', async () => {
    COLLATERALS = [await template.collaterals(0), await template.collaterals(1)]
  })

  context('when the creation fails', () => {
    const FINANCE_PERIOD = 0
    daoID = randomId()

    context('Prepare transaction', () => {
      it('should revert when no board members are provided', async () => {
        await assertRevert(() =>
          template.prepareInstance(BOARD_TOKEN_NAME, BOARD_TOKEN_SYMBOL, [], BOARD_VOTING_SETTINGS, FINANCE_PERIOD, {
            from: owner,
          })
        )
      })
    })

    context('Share transaction', () => {
      context('when there is no prepared instance deployed', () => {
        it('should revert', async () => {
          await assertRevert(() =>
            template.installShareApps(SHARE_TOKEN_NAME, SHARE_TOKEN_SYMBOL, SHARE_VOTING_SETTINGS, {
              from: owner,
            })
          )
        })
      })
    })

    context('Fundraising transaction', () => {
      beforeEach('deploy prepared instance', async () => {
        await template.prepareInstance(BOARD_TOKEN_NAME, BOARD_TOKEN_SYMBOL, BOARD_MEMBERS, BOARD_VOTING_SETTINGS, FINANCE_PERIOD, {
          from: owner,
        })
      })

      context('when there is no share instance deployed', () => {
        it('should revert', async () => {
          await assertRevert(() =>
            template.installFundraisingApps(
              PRESALE_GOAL,
              PRESALE_PERIOD,
              PRESALE_EXCHANGE_RATE,
              VESTING_CLIFF_PERIOD,
              VESTING_COMPLETE_PERIOD,
              PERCENT_SUPPLY_OFFERED,
              PERCENT_FUNDING_FOR_BENEFICIARY,
              START_DATE,
              BATCH_BLOCKS,
              MAXIMUM_TAP_RATE_INCREASE_PCT,
              MAXIMUM_TAP_FLOOR_DECREASE_PCT,
              {
                from: owner,
              }
            )
          )
        })
      })
    })

    context('Finalize transaction', () => {
      beforeEach('deploy share instance', async () => {
        await template.prepareInstance(BOARD_TOKEN_NAME, BOARD_TOKEN_SYMBOL, BOARD_MEMBERS, BOARD_VOTING_SETTINGS, FINANCE_PERIOD, {
          from: owner,
        })
        await template.installShareApps(SHARE_TOKEN_NAME, SHARE_TOKEN_SYMBOL, SHARE_VOTING_SETTINGS, {
          from: owner,
        })
      })

      context('when there is no fundraising instance deployed', () => {
        it('should revert', async () => {
          await assertRevert(() =>
            template.finalizeInstance(daoID, VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, SLIPPAGES, RATES[0], FLOORS[0], {
              from: owner,
            })
          )
        })
      })

      context('when there is a fundraising instance deployed', () => {
        beforeEach('deploy fundraising instance', async () => {
          await template.installFundraisingApps(
            PRESALE_GOAL,
            PRESALE_PERIOD,
            PRESALE_EXCHANGE_RATE,
            VESTING_CLIFF_PERIOD,
            VESTING_COMPLETE_PERIOD,
            PERCENT_SUPPLY_OFFERED,
            PERCENT_FUNDING_FOR_BENEFICIARY,
            START_DATE,
            BATCH_BLOCKS,
            MAXIMUM_TAP_RATE_INCREASE_PCT,
            MAXIMUM_TAP_FLOOR_DECREASE_PCT,
            {
              from: owner,
            }
          )
        })

        it('should revert when an empty id is provided', async () => {
          await assertRevert(() =>
            template.finalizeInstance('', VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, SLIPPAGES, RATES[0], FLOORS[0], {
              from: owner,
            })
          )
        })
      })
    })
  })

  context('when the creation succeeds', () => {
    let prepareReceipt, shareReceipt, fundraisingReceipt, finalizationReceipt

    const loadDAO = async () => {
      dao = Kernel.at(getEventArgument(prepareReceipt, 'DeployDao', 'dao'))
      acl = ACL.at(await dao.acl())

      boardToken = MiniMeToken.at(getEventArgument(prepareReceipt, 'DeployToken', 'token', 0))
      shareToken = MiniMeToken.at(getEventArgument(shareReceipt, 'DeployToken', 'token', 0))

      const installedAppsDuringPrepare = getInstalledAppsById(prepareReceipt)
      const installedAppsDuringShare = getInstalledAppsById(shareReceipt)
      const installedAppsDuringFundraising = getInstalledAppsById(fundraisingReceipt)

      assert.equal(installedAppsDuringPrepare['token-manager'].length, 1, 'should have installed 1 token-manager apps during prepare')
      assert.equal(installedAppsDuringShare['token-manager'].length, 1, 'should have installed 1 token-manager apps during share')
      boardTokenManager = TokenManager.at(installedAppsDuringPrepare['token-manager'][0])
      shareTokenManager = TokenManager.at(installedAppsDuringShare['token-manager'][0])

      assert.equal(installedAppsDuringPrepare.voting.length, 1, 'should have installed 1 voting apps during prepare')
      assert.equal(installedAppsDuringShare.voting.length, 1, 'should have installed 1 voting apps during share')
      boardVoting = Voting.at(installedAppsDuringPrepare.voting[0])
      shareVoting = Voting.at(installedAppsDuringShare.voting[0])

      assert.equal(installedAppsDuringPrepare.vault.length, 1, 'should have installed 1 vault app')
      vault = Vault.at(installedAppsDuringPrepare.vault[0])

      assert.equal(installedAppsDuringPrepare.finance.length, 1, 'should have installed 1 finance app')
      finance = Finance.at(installedAppsDuringPrepare.finance[0])

      assert.equal(installedAppsDuringFundraising.agent.length, 1, 'should have installed 1 agent app')
      reserve = Agent.at(installedAppsDuringFundraising.agent[0])

      assert.equal(installedAppsDuringFundraising.presale.length, 1, 'should have installed 1 presale app')
      presale = Presale.at(installedAppsDuringFundraising.presale[0])

      assert.equal(installedAppsDuringFundraising['batched-bancor-market-maker'].length, 1, 'should have installed 1 market-maker app')
      marketMaker = MarketMaker.at(installedAppsDuringFundraising['batched-bancor-market-maker'][0])

      assert.equal(installedAppsDuringFundraising.tap.length, 1, 'should have installed 1 tap app')
      tap = Tap.at(installedAppsDuringFundraising.tap[0])

      assert.equal(installedAppsDuringFundraising['aragon-fundraising'].length, 1, 'should have installed 1 aragon-fundraising app')
      controller = Controller.at(installedAppsDuringFundraising['aragon-fundraising'][0])
    }

    const itCostsUpTo = expectedCost => {
      it(`gas costs for each transaction must be up to ~${expectedCost} gas`, async () => {
        const prepareCost = prepareReceipt.receipt.gasUsed
        assert.isAtMost(prepareCost, expectedCost, `prepare transaction should cost up to ${expectedCost} gas`)

        const shareCost = shareReceipt.receipt.gasUsed
        assert.isAtMost(shareCost, expectedCost, `share transaction should cost up to ${expectedCost} gas`)

        const fundraisingCost = fundraisingReceipt.receipt.gasUsed
        assert.isAtMost(fundraisingCost, expectedCost, `fundraising transaction should cost up to ${expectedCost} gas`)

        const finalizationCost = finalizationReceipt.receipt.gasUsed
        assert.isAtMost(finalizationCost, expectedCost, `finalization transaction should cost up to ${expectedCost} gas`)
      })
    }

    const itSetupsDAOCorrectly = financePeriod => {
      context('ENS', () => {
        it('should have registered a new DAO on ENS', async () => {
          const ens = ENS.at((await deployedAddresses()).registry)
          const aragonIdNameHash = namehash(`${daoID}.aragonid.eth`)
          const resolvedAddress = await PublicResolver.at(await ens.resolver(aragonIdNameHash)).addr(aragonIdNameHash)
          assert.equal(resolvedAddress, dao.address, 'aragonId ENS name does not match')
        })
      })

      context('System', () => {
        it('should have Kernel permissions correctly setup ', async () => {
          await assertRole(acl, dao, shareVoting, 'APP_MANAGER_ROLE')
        })

        it('should have ACL permissions correctly setup ', async () => {
          await assertRole(acl, acl, shareVoting, 'CREATE_PERMISSIONS_ROLE')
        })

        it('should have EVM scripts registry permissions correctly setup', async () => {
          const reg = await EVMScriptRegistry.at(await acl.getEVMScriptRegistry())
          await assertRole(acl, reg, shareVoting, 'REGISTRY_MANAGER_ROLE')
          await assertRole(acl, reg, shareVoting, 'REGISTRY_ADD_EXECUTOR_ROLE')
        })
      })

      context('Board', () => {
        it('should have created a new board token', async () => {
          assert.equal(await boardToken.name(), BOARD_TOKEN_NAME)
          assert.equal(await boardToken.symbol(), BOARD_TOKEN_SYMBOL)
          assert.equal(await boardToken.transfersEnabled(), false)
          assert.equal((await boardToken.decimals()).toNumber(), 0)
        })

        it('should have minted requested amounts for the board members', async () => {
          assert.equal((await boardToken.totalSupply()).toString(), BOARD_MEMBERS.length)
          for (const holder of BOARD_MEMBERS) assert.equal((await boardToken.balanceOf(holder)).toNumber(), 1)
        })

        it('should have board token manager app correctly setup', async () => {
          assert.isTrue(await boardTokenManager.hasInitialized(), 'token manager not initialized')
          assert.equal(await boardTokenManager.token(), boardToken.address)

          await assertRole(acl, boardTokenManager, shareVoting, 'MINT_ROLE', boardVoting)
          await assertRole(acl, boardTokenManager, shareVoting, 'BURN_ROLE', boardVoting)

          await assertMissingRole(acl, boardTokenManager, 'ISSUE_ROLE')
          await assertMissingRole(acl, boardTokenManager, 'ASSIGN_ROLE')
          await assertMissingRole(acl, boardTokenManager, 'REVOKE_VESTINGS_ROLE')
        })

        it('should have board voting app correctly setup', async () => {
          assert.isTrue(await boardVoting.hasInitialized(), 'voting not initialized')
          assert.equal((await boardVoting.supportRequiredPct()).toString(), BOARD_SUPPORT_REQUIRED)
          assert.equal((await boardVoting.minAcceptQuorumPct()).toString(), BOARD_MIN_ACCEPTANCE_QUORUM)
          assert.equal((await boardVoting.voteTime()).toString(), BOARD_VOTE_DURATION)

          await assertRole(acl, boardVoting, shareVoting, 'CREATE_VOTES_ROLE', boardTokenManager)
          await assertRole(acl, boardVoting, shareVoting, 'MODIFY_QUORUM_ROLE', boardVoting)
          await assertRole(acl, boardVoting, shareVoting, 'MODIFY_SUPPORT_ROLE', boardVoting)
        })

        it('should have vault app correctly setup', async () => {
          assert.isTrue(await vault.hasInitialized(), 'vault not initialized')

          assert.equal(await dao.recoveryVaultAppId(), APP_IDS.vault, 'vault app is not being used as the vault app of the DAO')
          assert.equal(web3.toChecksumAddress(await finance.vault()), vault.address, 'finance vault is not the vault app')
          assert.equal(web3.toChecksumAddress(await dao.getRecoveryVault()), vault.address, 'vault app is not being used as the vault app of the DAO')

          await assertRole(acl, vault, shareVoting, 'TRANSFER_ROLE', finance)
        })

        it('should have finance app correctly setup', async () => {
          assert.isTrue(await finance.hasInitialized(), 'finance not initialized')

          const expectedPeriod = financePeriod === 0 ? MONTHS : financePeriod
          assert.equal((await finance.getPeriodDuration()).toString(), expectedPeriod, 'finance period should be 30 days')

          await assertRole(acl, finance, shareVoting, 'CREATE_PAYMENTS_ROLE', boardVoting)
          await assertRole(acl, finance, shareVoting, 'EXECUTE_PAYMENTS_ROLE', boardVoting)
          await assertRole(acl, finance, shareVoting, 'MANAGE_PAYMENTS_ROLE', boardVoting)

          await assertMissingRole(acl, finance, 'CHANGE_PERIOD_ROLE')
          await assertMissingRole(acl, finance, 'CHANGE_BUDGETS_ROLE')
        })
      })

      context('Shareholders', () => {
        it('should have created a new share token', async () => {
          assert.equal(await shareToken.name(), SHARE_TOKEN_NAME)
          assert.equal(await shareToken.symbol(), SHARE_TOKEN_SYMBOL)
          assert.equal(await shareToken.transfersEnabled(), true)
          assert.equal((await shareToken.decimals()).toString(), 18)
        })

        it('should have share token manager app correctly setup', async () => {
          assert.isTrue(await shareTokenManager.hasInitialized(), 'token manager not initialized')
          assert.equal(await shareTokenManager.token(), shareToken.address)

          await assertRole(acl, shareTokenManager, shareVoting, 'MINT_ROLE', marketMaker)
          await assertRole(acl, shareTokenManager, shareVoting, 'BURN_ROLE', marketMaker)
          await assertRole(acl, shareTokenManager, shareVoting, 'BURN_ROLE', presale)
          await assertRole(acl, shareTokenManager, shareVoting, 'ISSUE_ROLE', presale)
          await assertRole(acl, shareTokenManager, shareVoting, 'ASSIGN_ROLE', presale)
          await assertRole(acl, shareTokenManager, shareVoting, 'REVOKE_VESTINGS_ROLE', presale)
        })

        it('should have share voting app correctly setup', async () => {
          assert.isTrue(await shareVoting.hasInitialized(), 'voting not initialized')
          assert.equal((await shareVoting.supportRequiredPct()).toString(), SHARE_SUPPORT_REQUIRED)
          assert.equal((await shareVoting.minAcceptQuorumPct()).toString(), SHARE_MIN_ACCEPTANCE_QUORUM)
          assert.equal((await shareVoting.voteTime()).toString(), SHARE_VOTE_DURATION)

          await assertRole(acl, shareVoting, shareVoting, 'CREATE_VOTES_ROLE', boardTokenManager)
          await assertRole(acl, shareVoting, shareVoting, 'MODIFY_QUORUM_ROLE')
          await assertRole(acl, shareVoting, shareVoting, 'MODIFY_SUPPORT_ROLE')
        })
      })

      context('Fundraising apps', () => {
        it('should have reserve / agent app correctly setup', async () => {
          assert.isTrue(await reserve.hasInitialized(), 'reserve / agent not initialized')

          assert.equal(await reserve.protectedTokens(0), COLLATERALS[0], 'DAI not protected')
          assert.equal(await reserve.protectedTokens(1), COLLATERALS[1], 'ANT not protected')

          await assertRole(acl, reserve, shareVoting, 'SAFE_EXECUTE_ROLE')
          await assertRole(acl, reserve, shareVoting, 'ADD_PROTECTED_TOKEN_ROLE', controller)
          await assertRole(acl, reserve, shareVoting, 'TRANSFER_ROLE', marketMaker)
          await assertRole(acl, reserve, shareVoting, 'TRANSFER_ROLE', tap)

          await assertMissingRole(acl, reserve, 'REMOVE_PROTECTED_TOKEN_ROLE')
          await assertMissingRole(acl, reserve, 'EXECUTE_ROLE')
          await assertMissingRole(acl, reserve, 'DESIGNATE_SIGNER_ROLE')
          await assertMissingRole(acl, reserve, 'ADD_PRESIGNED_HASH_ROLE')
          await assertMissingRole(acl, reserve, 'RUN_SCRIPT_ROLE')
        })

        it('should have presale app correctly setup', async () => {
          assert.isTrue(await presale.hasInitialized(), 'presale not initialized')

          assert.equal(web3.toChecksumAddress(await presale.controller()), controller.address)
          assert.equal(web3.toChecksumAddress(await presale.tokenManager()), shareTokenManager.address)
          assert.equal(await presale.token(), shareToken.address)
          assert.equal(web3.toChecksumAddress(await presale.reserve()), reserve.address)
          assert.equal(web3.toChecksumAddress(await presale.beneficiary()), vault.address)
          assert.equal(web3.toChecksumAddress(await presale.contributionToken()), web3.toChecksumAddress(COLLATERALS[0]))
          assert.equal((await presale.goal()).toNumber(), PRESALE_GOAL)
          assert.equal((await presale.period()).toNumber(), PRESALE_PERIOD)
          assert.equal((await presale.exchangeRate()).toNumber(), PRESALE_EXCHANGE_RATE)
          assert.equal((await presale.vestingCliffPeriod()).toNumber(), VESTING_CLIFF_PERIOD)
          assert.equal((await presale.vestingCompletePeriod()).toNumber(), VESTING_COMPLETE_PERIOD)
          assert.equal((await presale.supplyOfferedPct()).toNumber(), PERCENT_SUPPLY_OFFERED)
          assert.equal((await presale.fundingForBeneficiaryPct()).toNumber(), PERCENT_FUNDING_FOR_BENEFICIARY)
          assert.equal((await presale.openDate()).toNumber(), START_DATE)

          await assertRole(acl, presale, shareVoting, 'OPEN_ROLE', controller)
          await assertRole(acl, presale, shareVoting, 'CONTRIBUTE_ROLE', controller)
        })

        it('should have market-maker app correctly setup', async () => {
          assert.isTrue(await marketMaker.hasInitialized(), 'market-maker not initialized')

          assert.equal(web3.toChecksumAddress(await marketMaker.controller()), controller.address)
          assert.equal(web3.toChecksumAddress(await marketMaker.tokenManager()), shareTokenManager.address)
          assert.equal(await marketMaker.token(), shareToken.address)
          // cannot check formula directly
          assert.equal(web3.toChecksumAddress(await marketMaker.reserve()), reserve.address)
          assert.equal(web3.toChecksumAddress(await marketMaker.beneficiary()), vault.address)
          assert.equal((await marketMaker.batchBlocks()).toNumber(), BATCH_BLOCKS)
          assert.equal((await marketMaker.buyFeePct()).toNumber(), 0)
          assert.equal((await marketMaker.sellFeePct()).toNumber(), 0)

          const dai = await marketMaker.getCollateralToken(COLLATERALS[0])
          const ant = await marketMaker.getCollateralToken(COLLATERALS[1])

          assert.isTrue(dai[0], 'DAI not whitelisted')
          assert.equal(dai[1].toNumber(), VIRTUAL_SUPPLIES[0], 'DAI virtual supply should be ' + VIRTUAL_SUPPLIES[0])
          assert.equal(dai[2].toNumber(), VIRTUAL_BALANCES[0], 'DAI virtual balance should be ' + VIRTUAL_BALANCES[0])
          assert.equal(dai[3].toNumber(), RESERVE_RATIOS[0], 'DAI reserve ratio should be ' + RESERVE_RATIOS[0])
          assert.equal(dai[4].toNumber(), SLIPPAGES[0], 'DAI maximum slippage should be ' + SLIPPAGES[0])

          assert.isTrue(ant[0], 'ANT not whitelisted')
          assert.equal(ant[1].toNumber(), VIRTUAL_SUPPLIES[1], 'ANT virtual supply should be ' + VIRTUAL_SUPPLIES[1])
          assert.equal(ant[2].toNumber(), VIRTUAL_BALANCES[1], 'ANT virtual balance should be ' + VIRTUAL_BALANCES[1])
          assert.equal(ant[3].toNumber(), RESERVE_RATIOS[1], 'ANT reserve ratio should be ' + RESERVE_RATIOS[1])
          assert.equal(ant[4].toNumber(), SLIPPAGES[1], 'ANT maximum slippage should be ' + SLIPPAGES[1])

          await assertRole(acl, marketMaker, shareVoting, 'OPEN_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'UPDATE_BENEFICIARY_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'UPDATE_FEES_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'ADD_COLLATERAL_TOKEN_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'REMOVE_COLLATERAL_TOKEN_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'UPDATE_COLLATERAL_TOKEN_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'OPEN_BUY_ORDER_ROLE', controller)
          await assertRole(acl, marketMaker, shareVoting, 'OPEN_SELL_ORDER_ROLE', controller)

          await assertMissingRole(acl, marketMaker, 'UPDATE_FORMULA_ROLE')
        })

        it('should have tap app correctly setup', async () => {
          assert.isTrue(await tap.hasInitialized(), 'tap not initialized')

          assert.equal(web3.toChecksumAddress(await tap.controller()), controller.address)
          assert.equal(web3.toChecksumAddress(await tap.reserve()), reserve.address)
          assert.equal(web3.toChecksumAddress(await tap.beneficiary()), vault.address)
          assert.equal((await tap.batchBlocks()).toNumber(), BATCH_BLOCKS)
          assert.equal((await tap.maximumTapRateIncreasePct()).toNumber(), MAXIMUM_TAP_RATE_INCREASE_PCT)
          assert.equal((await tap.maximumTapFloorDecreasePct()).toNumber(), MAXIMUM_TAP_FLOOR_DECREASE_PCT)

          assert.equal((await tap.rates(COLLATERALS[0])).toNumber(), RATES[0], 'DAI tap rate should be ' + RATES[0])
          assert.equal((await tap.floors(COLLATERALS[0])).toNumber(), FLOORS[0], 'DAI tap floor should be ' + FLOORS[0])

          await assertRole(acl, tap, shareVoting, 'UPDATE_BENEFICIARY_ROLE', controller)
          await assertRole(acl, tap, shareVoting, 'UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE', controller)
          await assertRole(acl, tap, shareVoting, 'UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE', controller)
          await assertRole(acl, tap, shareVoting, 'ADD_TAPPED_TOKEN_ROLE', controller)
          await assertRole(acl, tap, shareVoting, 'UPDATE_TAPPED_TOKEN_ROLE', controller)
          await assertRole(acl, tap, shareVoting, 'RESET_TAPPED_TOKEN_ROLE', controller)
          await assertRole(acl, tap, shareVoting, 'WITHDRAW_ROLE', controller)

          await assertMissingRole(acl, tap, 'UPDATE_CONTROLLER_ROLE')
          await assertMissingRole(acl, tap, 'UPDATE_RESERVE_ROLE')
          await assertMissingRole(acl, tap, 'REMOVE_TAPPED_TOKEN_ROLE')
        })

        it('should have aragon-fundraising app correctly setup', async () => {
          assert.isTrue(await controller.hasInitialized(), 'aragon-fundraising not initialized')

          assert.equal(web3.toChecksumAddress(await controller.presale()), presale.address)
          assert.equal(web3.toChecksumAddress(await controller.marketMaker()), marketMaker.address)
          assert.equal(web3.toChecksumAddress(await controller.reserve()), reserve.address)
          assert.equal(web3.toChecksumAddress(await controller.tap()), tap.address)
          assert.equal(await controller.toReset(0), COLLATERALS[0])
          await assertRevert(() => controller.toReset(1))

          await assertRole(acl, controller, shareVoting, 'UPDATE_BENEFICIARY_ROLE')
          await assertRole(acl, controller, shareVoting, 'UPDATE_FEES_ROLE')
          await assertRole(acl, controller, shareVoting, 'ADD_COLLATERAL_TOKEN_ROLE')
          await assertRole(acl, controller, shareVoting, 'REMOVE_COLLATERAL_TOKEN_ROLE')
          await assertRole(acl, controller, shareVoting, 'UPDATE_COLLATERAL_TOKEN_ROLE')
          await assertRole(acl, controller, shareVoting, 'UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE')
          await assertRole(acl, controller, shareVoting, 'UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE')
          await assertRole(acl, controller, shareVoting, 'ADD_TOKEN_TAP_ROLE')
          await assertRole(acl, controller, shareVoting, 'UPDATE_TOKEN_TAP_ROLE')
          await assertRole(acl, controller, shareVoting, 'OPEN_PRESALE_ROLE', boardVoting)
          await assertRole(acl, controller, shareVoting, 'OPEN_TRADING_ROLE', presale)
          await assertRole(acl, controller, shareVoting, 'CONTRIBUTE_ROLE', ANY_ADDRESS)
          await assertRole(acl, controller, shareVoting, 'OPEN_BUY_ORDER_ROLE', ANY_ADDRESS)
          await assertRole(acl, controller, shareVoting, 'OPEN_SELL_ORDER_ROLE', ANY_ADDRESS)
          await assertRole(acl, controller, shareVoting, 'WITHDRAW_ROLE', ANY_ADDRESS)
        })
      })
    }

    const createDAO = financePeriod => {
      before('create fundraising entity with multisig', async () => {
        daoID = randomId()
        prepareReceipt = await template.prepareInstance(BOARD_TOKEN_NAME, BOARD_TOKEN_SYMBOL, BOARD_MEMBERS, BOARD_VOTING_SETTINGS, financePeriod, {
          from: owner,
        })
        shareReceipt = await template.installShareApps(SHARE_TOKEN_NAME, SHARE_TOKEN_SYMBOL, SHARE_VOTING_SETTINGS, {
          from: owner,
        })
        fundraisingReceipt = await template.installFundraisingApps(
          PRESALE_GOAL,
          PRESALE_PERIOD,
          PRESALE_EXCHANGE_RATE,
          VESTING_CLIFF_PERIOD,
          VESTING_COMPLETE_PERIOD,
          PERCENT_SUPPLY_OFFERED,
          PERCENT_FUNDING_FOR_BENEFICIARY,
          START_DATE,
          BATCH_BLOCKS,
          MAXIMUM_TAP_RATE_INCREASE_PCT,
          MAXIMUM_TAP_FLOOR_DECREASE_PCT,
          {
            from: owner,
          }
        )
        finalizationReceipt = await template.finalizeInstance(daoID, VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, SLIPPAGES, RATES[0], FLOORS[0], {
          from: owner,
        })

        await loadDAO()
      })
    }

    context('when requesting a custom finance period', () => {
      const FINANCE_PERIOD = 60 * 60 * 24 * 15 // 15 days

      createDAO(FINANCE_PERIOD)
      itCostsUpTo(6.8e6)
      itSetupsDAOCorrectly(FINANCE_PERIOD)
    })

    context('when requesting a default finance period', () => {
      const FINANCE_PERIOD = 0 // use default

      createDAO(FINANCE_PERIOD)
      itCostsUpTo(6.8e6)
      itSetupsDAOCorrectly(FINANCE_PERIOD)
    })
  })
})
