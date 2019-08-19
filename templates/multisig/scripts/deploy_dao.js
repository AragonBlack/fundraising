const Template = artifacts.require('FundraisingMultisigTemplate')
const TokenMock = artifacts.require('TokenMock')

const { getEventArgument } = require('@aragon/test-helpers/events')

const ONE_DAY = 60 * 60 * 24
const ONE_WEEK = ONE_DAY * 7

const BOARD_MEMBERS = ['0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', '0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb ']

const BOARD_TOKEN_NAME = 'Board Token'
const BOARD_TOKEN_SYMBOL = 'BOARD'

const SHARE_TOKEN_NAME = 'Share Token'
const SHARE_TOKEN_SYMBOL = 'SHARE'

const BOARD_VOTE_DURATION = ONE_WEEK
const BOARD_SUPPORT_REQUIRED = 50e16
const BOARD_MIN_ACCEPTANCE_QUORUM = 40e16
const BOARD_VOTING_SETTINGS = [BOARD_SUPPORT_REQUIRED, BOARD_MIN_ACCEPTANCE_QUORUM, BOARD_VOTE_DURATION]

const SHARE_VOTE_DURATION = ONE_WEEK
const SHARE_SUPPORT_REQUIRED = 50e16
const SHARE_MIN_ACCEPTANCE_QUORUM = 5e16
const SHARE_VOTING_SETTINGS = [SHARE_SUPPORT_REQUIRED, SHARE_MIN_ACCEPTANCE_QUORUM, SHARE_VOTE_DURATION]

const MAX_TAP_INCREASE_PCT = Math.pow(10, 17)

const VIRTUAL_SUPPLIES = [Math.pow(10, 19), Math.pow(10, 18)]
const VIRTUAL_BALANCES = [2 * Math.pow(10, 19), 2 * Math.pow(10, 18)]
const TAPS = [20000, 5000]
const FLOORS = [150, 750]
const SLIPPAGES = [3 * Math.pow(10, 19), Math.pow(10, 18)]

const ID = 'fundraising' + Math.random()

module.exports = async callback => {
  try {
    const collateral1 = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 1000000000000000000)
    const collateral2 = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 1000000000000000000)
    const COLLATERALS = [collateral1.address, collateral2.address]

    const template = await Template.at(process.argv[6])
    const receipt = await template.deployBaseInstance(BOARD_TOKEN_NAME, BOARD_TOKEN_SYMBOL, BOARD_MEMBERS, BOARD_VOTING_SETTINGS, 0)
    await template.installFundraisingApps(ID, SHARE_TOKEN_NAME, SHARE_TOKEN_SYMBOL, SHARE_VOTING_SETTINGS, MAX_TAP_INCREASE_PCT)
    await template.finalizeInstance(COLLATERALS, VIRTUAL_SUPPLIES, VIRTUAL_BALANCES, SLIPPAGES, TAPS, FLOORS)
    const dao = getEventArgument(receipt, 'DeployDao', 'dao')

    console.log('DAO deployed at ' + dao)
  } catch (err) {
    console.log(err)
  }

  callback()
}
