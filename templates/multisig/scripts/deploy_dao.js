const Template = artifacts.require('FundraisingMultisigTemplate')

const { getEventArgument } = require('@aragon/test-helpers/events')

const DAYS = 24 * 3600
const WEEKS = 7 * DAYS
const PPM = 1e6

const BOARD_MEMBERS = ['0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', '0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb ']

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

const PRESALE_GOAL = 100e18
const PRESALE_PERIOD = 14 * DAYS
const PRESALE_EXCHANGE_RATE = PPM
const VESTING_CLIFF_PERIOD = 90 * DAYS
const VESTING_COMPLETE_PERIOD = 360 * DAYS
const PERCENT_SUPPLY_OFFERED = 0.9 * PPM // 90%
const PERCENT_FUNDING_FOR_BENEFICIARY = 0.25 * PPM // 25%

const MAXIMUM_TAP_RATE_INCREASE_PCT = 5 * Math.pow(10, 17)
const MAXIMUM_TAP_FLOOR_DECREASE_PCT = 5 * Math.pow(10, 17)

const VIRTUAL_SUPPLIES = [Math.pow(10, 23), Math.pow(10, 23)]
const VIRTUAL_BALANCES = [Math.pow(10, 22), Math.pow(10, 22)]
const RESERVE_RATIOS = [100000, 10000]
const RATE = 5 * Math.pow(10, 15)
const FLOOR = Math.pow(10, 21)
const SLIPPAGES = [2 * Math.pow(10, 17), Math.pow(10, 18)]
const BATCH_BLOCKS = 1

const ID = 'fundraising' + Math.random()

module.exports = async callback => {
  try {
    if (process.argv[4] === 'rpc') {
      const template = await Template.at(process.argv[7])

      const receipt = await template.prepareInstance(
        BOARD_TOKEN_NAME,
        BOARD_TOKEN_SYMBOL,
        BOARD_MEMBERS,
        [BOARD_SUPPORT_REQUIRED, BOARD_MIN_ACCEPTANCE_QUORUM, 60],
        0
      )
      await template.installShareApps(ID, SHARE_TOKEN_NAME, SHARE_TOKEN_SYMBOL, SHARE_VOTING_SETTINGS)
      await template.installFundraisingApps(
        PRESALE_GOAL,
        PRESALE_PERIOD,
        PRESALE_EXCHANGE_RATE,
        VESTING_CLIFF_PERIOD,
        VESTING_COMPLETE_PERIOD,
        PERCENT_SUPPLY_OFFERED,
        PERCENT_FUNDING_FOR_BENEFICIARY,
        0,
        BATCH_BLOCKS,
        MAXIMUM_TAP_RATE_INCREASE_PCT,
        MAXIMUM_TAP_FLOOR_DECREASE_PCT
      )
      await template.finalizeInstance(VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, SLIPPAGES, RATE, FLOOR)

      const dao = getEventArgument(receipt, 'DeployDao', 'dao')
      console.log('DAO deployed at ' + dao)
    } else if (process.argv[4] === 'hatch') {
      /**
       * TODO
       */
      // const COLLATERALS = ['0x0527e400502d0cb4f214dd0d2f2a323fc88ff924', '0x0d5263b7969144a852d58505602f630f9b20239d']
      // const owner = '0xb71d2d88030a00830c3d45f84c12cc8aaf6857a5'
      // const template = await Template.at(process.argv[7])
      // const receipt = await template.deployBaseInstance(BOARD_TOKEN_NAME, BOARD_TOKEN_SYMBOL, BOARD_MEMBERS, BOARD_VOTING_SETTINGS, 0, { from: owner })
      // await template.installFundraisingApps(ID, SHARE_TOKEN_NAME, SHARE_TOKEN_SYMBOL, SHARE_VOTING_SETTINGS, MAX_TAP_INCREASE_PCT, { from: owner })
      // await template.finalizeInstance(COLLATERALS, VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, SLIPPAGES, TAPS, FLOORS, { from: owner })
      // const dao = getEventArgument(receipt, 'DeployDao', 'dao')
      // console.log('DAO deployed at ' + dao)
    } else {
      throw new Error('Unknown network: pick rpc or hatch')
    }
  } catch (err) {
    console.log(err)
  }

  callback()
}
