import {
  ready,
  checkCollaterals,
  computeConstants,
  computeValues,
  computePresale,
  computeCollaterals,
  computeBondedToken,
  computeBatches,
  computeOrders,
} from './utils'

/**
 * Reduces the backgorund script state to an intelligible one for the frontend
 * @param {Object} state - the background script state
 * @returns {Object} a reduced state, easier to interact with on the frontend
 */
const appStateReducer = state => {
  // don't reduce not yet populated state
  const isReady = ready(state)
  if (isReady) {
    const { constants, values, network, presale, collaterals, bondedToken, batches, orders } = state
    const computedConstants = computeConstants(constants)
    const computedValues = computeValues(values)
    const computedPresale = computePresale(presale)
    const computedCollaterals = computeCollaterals(collaterals)
    const computedBondedToken = computeBondedToken(bondedToken, computedCollaterals)
    const computedBatches = computeBatches(batches, computedConstants.PPM)
    const computedOrders = computeOrders(orders, computedBatches)
    return {
      ...state,
      isReady,
      constants: computedConstants,
      values: computedValues,
      collateralsAreOk: checkCollaterals(collaterals, network),
      presale: computedPresale,
      collaterals: computedCollaterals,
      bondedToken: computedBondedToken,
      batches: computedBatches,
      orders: computedOrders,
    }
  } else {
    return {
      ...state,
      isReady,
    }
  }
}

export default appStateReducer
