import getMinutes from 'date-fns/getMinutes'
import getTime from 'date-fns/getTime'
import set from 'date-fns/set'
import groupBy from 'lodash/groupBy'
import minBy from 'lodash.minBy'
import maxBy from 'lodash.maxBy'

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
export const getDay = timestamp => getTime(set(timestamp, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }))

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
  const functionToCall = [getTenMinutes, getTwentyMinutes, getHour, getDay][functionIndex]
  const range = groupBy(orders, o => functionToCall(o.timestamp))
  const x = []
  const open = []
  const close = []
  const high = []
  const low = []
  Object.keys(range).forEach(i => {
    x.push(parseInt(i, 10))
    const ochl = getOCHL(range[i])
    open.push(ochl.open)
    close.push(ochl.close)
    high.push(ochl.high)
    low.push(ochl.low)
  })
  return { x, open, close, high, low }
}
