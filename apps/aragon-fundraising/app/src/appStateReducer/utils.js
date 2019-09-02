import cloneDeep from 'lodash.clonedeep'
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
  const hasTaps = state && [...state?.collaterals.values()].every(c => c.tap)
  return synced && hasCollaterals && hasTaps
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
  maximumTapIncreasePct: new BigNumber(values.maximumTapIncreasePct),
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
    tap: {
      ...data.tap,
      rate: new BigNumber(data.tap.rate),
      floor: new BigNumber(data.tap.floor),
    },
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
      dai: realSupply.plus(dai.virtualBalance),
      ant: realSupply.plus(ant.virtualBalance),
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
    const balance = new BigNumber(b.balance)
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
      balance,
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
