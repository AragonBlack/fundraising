import cloneDeep from 'lodash.cloneDeep'
import BigNumber from 'bignumber.js'
import { Order, Tokens } from '../constants'

/**
 * Checks whether we have enough data to start the fundraising app
 * @param {Object} state - the background script state
 * @returns {boolean} true if ready, false otherwise
 */
// TODO: check if we can start the app with no collateral token
export const ready = state => {
  const synced = !state?.isSyncing
  const hasCollaterals = state?.collaterals.size > 0
  const hasTaps = state && [...state?.collaterals.values()].some(c => c.tap)
  const presaleStateIsKnown = state?.presale?.state
  return synced && hasCollaterals && hasTaps && presaleStateIsKnown
}

/**
 * DAI and ANT are the only collaterals accepted to start the app on rinkeby or mainnet
 * @param {Map} collaterals - collaterals found in the app
 * @param {Object} network - id and type of the network
 * @returns {boolean} true if network is rinkeby or mainnet and collaterals are the good ones, true no matter what on any other networks
 */
export const checkCollaterals = (collaterals, { type }) => {
  if (type === 'main' || type === 'rinkeby') {
    // verified addresses
    const realDaiAddress = Tokens[type].DAI.toLowerCase()
    const realAntAddress = Tokens[type].ANT.toLowerCase()
    // get DAI and ANT addresses from the fundraising app
    const currentCollaterals = Array.from(collaterals).map(([address, { symbol }]) => ({ address, symbol }))
    const daiAddress = currentCollaterals.find(c => c.symbol === 'DAI')
    const antAddress = currentCollaterals.find(c => c.symbol === 'ANT')
    // check they are the same
    const sameDai = daiAddress?.toLowerCase() === realDaiAddress
    const sameAnt = antAddress?.toLowerCase() === realAntAddress
    return sameDai && sameAnt
  } else return true
}

/**
 * Converts constants to big numbers
 * @param {Object} constants - background script constants data
 * @returns {Object} transformed constants
 */
export const computeConstants = constants => ({
  ...constants,
  PPM: new BigNumber(constants.PPM),
  PCT_BASE: new BigNumber(constants.PCT_BASE),
})

/**
 * Converts constants to big numbers
 * @param {Object} values - background script values data
 * @returns {Object} transformed constants
 */
export const computeValues = values => ({
  ...values,
  maximumTapRateIncreasePct: new BigNumber(values.maximumTapRateIncreasePct),
  maximumTapFloorDecreasePct: new BigNumber(values.maximumTapFloorDecreasePct),
})

/**
 * Compute some data related to the presale
 * @param {Object} presale - background script presale data
 * @param {BigNumber} PPM - part per million
 * @returns {Object} transformed presale
 */
export const computePresale = (presale, PPM) => ({
  ...presale,
  exchangeRate: new BigNumber(presale.exchangeRate).div(PPM),
  goal: new BigNumber(presale.goal),
  totalRaised: new BigNumber(presale.totalRaised),
})

/**
 * Converts collateral strings to BigNumber where needed
 * TODO: handle balances when PR#361 lands
 * @param {String} address - collateral address
 * @param {Object} data - collateral data
 * @returns {Object} transformed collateral
 */
const transformCollateral = (address, data) => {
  const virtualBalance = new BigNumber(data.virtualBalance)
  const toBeClaimed = new BigNumber(data.toBeClaimed)
  const actualBalance = new BigNumber(data.actualBalance)
  const realBalance = actualBalance.minus(toBeClaimed)
  const overallBalance = realBalance.plus(virtualBalance)
  // only DAI collateral has a tap
  const tap = data.tap ? { ...data.tap, rate: new BigNumber(data.tap.rate), floor: new BigNumber(data.tap.floor) } : null
  return {
    address,
    ...data,
    reserveRatio: new BigNumber(data.reserveRatio),
    virtualSupply: new BigNumber(data.virtualSupply),
    slippage: new BigNumber(data.slippage),
    virtualBalance,
    toBeClaimed,
    actualBalance,
    realBalance,
    overallBalance,
    tap,
  }
}

/**
 * Converts the background script collaterals to an object with BigNumbers for a better handling in the frontend
 * @param {Map} collaterals - background script collaterals data
 * @returns {Object} the computed collaterals
 */
export const computeCollaterals = collaterals => {
  const computedCollaterals = Array.from(cloneDeep(collaterals))
  const [daiAddress, daiData] = computedCollaterals.find(([_, data]) => data.symbol === 'DAI')
  const [antAddress, antData] = computedCollaterals.find(([_, data]) => data.symbol === 'ANT')
  return {
    dai: transformCollateral(daiAddress, daiData),
    ant: transformCollateral(antAddress, antData),
  }
}

/**
 * Converts the background script bondedToken with BigNumbers for a better handling in the frontend
 * @param {Object} bondedToken - background script bondedToken data
 * @param {Object} collaterals - fundraising collaterals
 * @returns {Object} the computed bondedToken
 */
export const computeBondedToken = (bondedToken, { dai, ant }) => {
  const totalSupply = new BigNumber(bondedToken.totalSupply)
  const toBeMinted = new BigNumber(bondedToken.toBeMinted)
  const realSupply = totalSupply.plus(toBeMinted)
  return {
    ...bondedToken,
    totalSupply,
    toBeMinted,
    realSupply,
    overallSupply: {
      dai: realSupply.plus(dai.virtualSupply),
      ant: realSupply.plus(ant.virtualSupply),
    },
  }
}

/**
 * Converts the background script batches with BigNumbers for a better handling in the frontend
 * @param {Array} batches - background script batches data
 * @param {BigNumber} PPM - part per million
 * @returns {Object} the computed batches
 */
export const computeBatches = (batches, PPM) => {
  return batches.map(b => {
    const supply = new BigNumber(b.supply)
    const realSupply = new BigNumber(b.realSupply)
    const balance = new BigNumber(b.balance)
    const virtualBalance = new BigNumber(b.virtualBalance)
    const realBalance = balance.minus(virtualBalance)
    const reserveRatio = new BigNumber(b.reserveRatio)
    const totalBuySpend = new BigNumber(b.totalBuySpend)
    const totalBuyReturn = new BigNumber(b.totalBuyReturn)
    const totalSellSpend = new BigNumber(b.totalSellSpend)
    const totalSellReturn = new BigNumber(b.totalSellReturn)
    const startPrice = balance.times(PPM).div(supply.times(reserveRatio))
    const buyPrice = totalBuySpend.div(totalBuyReturn)
    const sellPrice = totalSellReturn.div(totalSellSpend)
    return {
      ...b,
      supply,
      realSupply,
      balance,
      virtualBalance,
      realBalance,
      reserveRatio,
      totalBuySpend,
      totalBuyReturn,
      totalSellSpend,
      totalSellReturn,
      startPrice,
      buyPrice,
      sellPrice,
    }
  })
}

/**
 * Converts the background script orders with BigNumbers for a better handling in the frontend
 * Also update the price of the order
 * @param {Array} orders - background script orders data
 * @param {Array} batches - computed batches
 * @returns {Object} the computed orders
 */
export const computeOrders = (orders, batches) => {
  return orders.map(o => {
    const batch = batches.find(b => b.id === o.batchId && b.collateral === o.collateral)
    let price, amount, value
    if (o.type === Order.type.BUY) {
      price = new BigNumber(batch.buyPrice ?? batch.startPrice)
      value = new BigNumber(o.value)
      amount = value.div(price)
    } else {
      price = new BigNumber(batch.sellPrice ?? batch.startPrice)
      amount = new BigNumber(o.amount)
      value = amount.times(price)
    }
    return {
      ...o,
      price,
      amount,
      value,
    }
  })
}
