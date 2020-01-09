import getMinutes from 'date-fns/getMinutes'
import getTime from 'date-fns/getTime'
import set from 'date-fns/set'
import groupBy from 'lodash/groupBy'
import minBy from 'lodash.minBy'
import maxBy from 'lodash.maxBy'

// ranges used to group orders
const ranges = [
  600000, // 10 minutes
  1200000, // 20 minutes
  3600000, // 1 hour
  86400000, // 1 day
]

/**
 * Returns the nearest and lower ten minute of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the nearest and lowest ten minute
 */
const getTenMinutes = timestamp => {
  const minutes = getMinutes(timestamp)
  const ten = Math.floor(minutes / 10) * 10
  return getTime(set(timestamp, { minutes: ten, seconds: 0, milliseconds: 0 }))
}

/**
 * Returns the nearest and lower twenty minute of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the nearest and lowest twenty minute
 */
const getTwentyMinutes = timestamp => {
  const minutes = getMinutes(timestamp)
  const twenty = Math.floor(minutes / 20) * 20
  return getTime(set(timestamp, { minutes: twenty, seconds: 0, milliseconds: 0 }))
}

/**
 * Returns the floored hour of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored hour
 */
const getHour = timestamp => getTime(set(timestamp, { minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Returns the floored day of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored day
 */
const getDay = timestamp => getTime(set(timestamp, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Get the OCHL (open, close, high, low) prices from an array of orders
 * @param {Array<Object>} orders - background script orders
 * @returns {Object} an object with the computed open, close, high, low prices
 */
const getOCHL = orders => {
  if (orders.length === 1) {
    const price = parseFloat(orders[0].price.toFixed(2, 1))
    return { open: price, close: price, high: price, low: price }
  } else {
    const open = parseFloat(minBy(orders, o => o.timestamp).price.toFixed(2, 1))
    const close = parseFloat(maxBy(orders, o => o.timestamp).price.toFixed(2, 1))
    const high = parseFloat(maxBy(orders, o => o.price.toFixed()).price.toFixed(2, 1))
    const low = parseFloat(minBy(orders, o => o.price.toFixed()).price.toFixed(2, 1))
    return { open, close, high, low }
  }
}

/**
 * Compute OCHL prices for the given orders, according to the timerange function
 * This timerange function is picked by index, this index coming from the PriceSticks chart
 * @param {Array<Object>} orders - background script orders
 * @param {Number} functionIndex - index of the timerange fuction to pick
 * @returns {Object} an object containing the arrays of OHCL values computed with the given timerange function
 */
export const computeOCHL = (orders, functionIndex) => {
  // select the grouping function through the functionIndex
  const functionToCall = [getTenMinutes, getTwentyMinutes, getHour, getDay][functionIndex]
  // group orders with the selected function
  const groups = groupBy(orders, o => functionToCall(o.timestamp))
  // extract min and max timestamps of the groups
  const groupsArray = Object.keys(groups).map(k => parseInt(k, 10))
  const min = Math.min(...groupsArray)
  const max = Math.max(...groupsArray)
  // select the quantity to add to fill empty groups
  const range = ranges[functionIndex]
  // create a filled range
  // e.g. fill the empty groups
  const filledRange = [min]
  let next = min + range
  if (next > max) {
    // only one group, add a second one anyway
    // so plotly will size the candlestick accordingly
    filledRange.push(next)
  } else {
    // regular case, fill between the min and max
    while (next <= max) {
      filledRange.push(next)
      next += range
    }
  }
  const x = []
  const open = []
  const close = []
  const high = []
  const low = []
  filledRange.forEach(i => {
    x.push(i)
    if (groups[i]) {
      // if there is some data matching this timestamp in the original groups, compute ochl
      const ochl = getOCHL(groups[i])
      open.push(ochl.open)
      close.push(ochl.close)
      high.push(ochl.high)
      low.push(ochl.low)
    } else {
      // else put null values
      open.push(null)
      close.push(null)
      high.push(null)
      low.push(null)
    }
  })
  return { x, open, close, high, low }
}
