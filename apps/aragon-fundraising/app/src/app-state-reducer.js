import { Order } from './constants'
import mock from './bg_mock.json'
import { ETHER_TOKEN_VERIFIED_BY_SYMBOL } from './lib/verified-tokens'
/**
 * Checks whether we have enough data to start the fundraising app
 * @param {Object} state - the background script state
 * @returns {boolean} true if ready, false otherwise
 */
// TODO: check if we can start the app with no collateral token and no tap
const ready = state => {
  const synced = !(state === null || state.isSyncing)
  const hasCollateralTokens = state !== null && state.collateralTokens
  const hasTaps = state !== null && state.taps
  return synced && hasCollateralTokens && hasTaps
}

/**
 * DAI and ANT are the only collaterals accepted to start the app on rinkeby or mainnet
 * @param {Map} collateralTokens - collaterals found in the app
 * @param {Object} network - id and type of the network
 * @returns {boolean} true if network is rinkeby or mainnet and collaterals are the good ones, true no matter what on any other networks
 */
const checkCollaterals = (collateralTokens, network) => {
  // TODO: check only mainnet and rinkeby, otherwise it's ok
  // https://github.com/aragon/dao-templates/blob/9886bba4c0/helpers/test-token-deployer/index.js
  // 0 is ANT and 9 DAI
  if (network.type === 'private') return true
  else {
    // if network type is not private we assume its one of the following:
    // main, kovan, rinkeby, ropsten
    const realDaiAddress = ETHER_TOKEN_VERIFIED_BY_SYMBOL.get('DAI').toLowerCase()
    const realAntAddress = ETHER_TOKEN_VERIFIED_BY_SYMBOL.get('ANT').toLowerCase()
    // get DAI and ANT addresses from the fundraising app
    const collaterals = Array.from(collateralTokens).map(([address, { symbol }]) => ({ address, symbol }))
    const daiAddress = collaterals.find(c => c.symbol === 'DAI')
    const antAddress = collaterals.find(c => c.symbol === 'ANT')
    // check they are the same
    const sameDai = daiAddress && daiAddress.toLowerCase() === realDaiAddress
    const sameAnt = antAddress && antAddress.toLowerCase() === realAntAddress
    return sameDai && sameAnt
  }
}

/**
 * Finds whether an order is cleared or not
 * @param {Array} order - an order coming from the state.orders
 * @param {Array} batches - the list of batches, from state.batches
 * @param {Number} currentBatch - id of the current batch
 * @returns {boolean} true if order is cleared, false otherwise
 */
const isCleared = ({ batchId, collateral }, batches, currentBatch) => {
  if (batchId === currentBatch) return false
  else return batches && batches.some(b => b.id === batchId && b.collateral === collateral)
}

/**
 * Finds whether an order is returned (aka. claimed) or not
 * @param {Array} order - an order coming from the state.orders
 * @param {Array} returns - the list of return buy and return sell, from state.returns
 * @returns {boolean} true if order is returned, false otherwise
 */
const isReturned = ({ address, collateral, batchId, type }, returns) => {
  return returns && returns.some(r => r.address === address && r.batchId === batchId && r.collateral === collateral && r.type === type)
}

/**
 * Augments the order with its given state, derived from the batches.
 * Updates the price of the order according to the `UpdatePricing` occuring during the batch.
 * And adds some info about the collateral token (symbol)
 * @param {Array} order - an order coming from the state.orders
 * @param {Array} batches - the list of batches, from state.batches
 * @param {Number} currentBatch - id of the current batch
 * @param {Array} returns - the list of return buy and return sell, from state.returns
 * @param {Map} collateralTokens - the map of exisiting collateralTokens
 * @returns {Object} the order augmented with its state
 */
const withStateAndCollateral = (order, batches, currentBatch, returns, collateralTokens) => {
  const { address, amount, collateral, timestamp, type, transactionHash, batchId } = order
  const symbol = collateralTokens.get(collateral).symbol
  const augmentedOrder = {
    transactionHash,
    address,
    amount,
    timestamp,
    type,
    symbol,
    collateral,
    batchId,
  }
  // handle price and tokens
  const batch = batches.find(b => b.id === batchId && b.collateral === collateral)
  if (batch) {
    if (type === Order.Type.BUY) {
      augmentedOrder.price = typeof batch.buyPrice !== 'undefined' ? batch.buyPrice : batch.startPrice
      augmentedOrder.tokens = amount / augmentedOrder.price
    } else {
      augmentedOrder.price = typeof batch.sellPrice !== 'undefined' ? batch.sellPrice : batch.startPrice
      augmentedOrder.tokens = amount * augmentedOrder.price
    }
  }
  // handle order state (a returned order means it's already cleared)
  if (isReturned(order, returns)) augmentedOrder.state = Order.State.RETURNED
  else if (isCleared(order, batches, currentBatch)) augmentedOrder.state = Order.State.OVER
  else augmentedOrder.state = Order.State.PENDING
  return augmentedOrder
}

/**
 * Reduces the backgorund script state to an intelligible one for the frontend
 * @param {Object} state - the background script state
 * @returns {Object} a reduced state, easier to interact with on the frontend
 */
const appStateReducer = state => {
  // TODO: remove this quick and dirty hack
  if (process.env.NODE_ENV === 'test') return mock
  // don't reduce not yet populated state
  const isReady = ready(state)
  if (isReady) {
    // compute some data to handle it easier on the frontend
    const {
      // common
      connectedAccount,
      beneficiary,
      bondedToken,
      addresses,
      currentBatch,
      batches,
      network,
      // reserve
      ppm,
      taps,
      collateralTokens,
      maximumTapIncreasePct,
      // orders
      orders,
      returns,
    } = state
    const daiAddress = Array.from(collateralTokens).find(t => t[1].symbol === 'DAI')[0]
    const tap = taps.get(daiAddress)
    const collateralsAreOk = checkCollaterals(collateralTokens, network)
    // common data
    const common = {
      connectedAccount,
      beneficiary,
      bondedToken,
      addresses,
      currentBatch,
      daiAddress,
      collateralTokens: Array.from(collateralTokens).map(([address, { symbol, reserveRatio }], i) => ({
        address,
        symbol,
        ratio: parseInt(reserveRatio, 10) / parseInt(ppm, 10),
      })),
      collateralsAreOk,
    }
    // overview tab data
    const overview = {
      startPrice: batches.find(b => b.id === currentBatch).startPrice,
      batches,
      reserve: collateralTokens.get(daiAddress).balance,
      tap,
    }
    // orders tab data
    const ordersView = orders.map(o => withStateAndCollateral(o, batches, currentBatch, returns, collateralTokens)).reverse()
    // reserve tab data
    const reserve = {
      tap,
      maximumTapIncreasePct,
    }
    // reduced state
    const reducedState = {
      isReady,
      common,
      overview,
      ordersView,
      reserve,
    }
    console.log(JSON.stringify(reducedState))
    return reducedState
  } else {
    return {
      ...state,
      isReady,
    }
  }
}

export default appStateReducer
