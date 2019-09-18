import getMinutes from 'date-fns/getMinutes'
import getHours from 'date-fns/getHours'
import getTime from 'date-fns/getTime'
import set from 'date-fns/set'
import setDay from 'date-fns/setDay'
import groupBy from 'lodash/groupBy'
import minBy from 'lodash/minBy'
import maxBy from 'lodash/maxBy'

/**
 * Returns the nearest and lower quarter hour of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the nearest and lower quarter hour
 */
const getQuarterHour = timestamp => {
  const minutes = getMinutes(timestamp)
  const quarter = Math.floor(minutes / 15) * 15
  return getTime(set(timestamp, { minutes: quarter, seconds: 0, milliseconds: 0 }))
}

/**
 * Returns the floored hour of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored hour
 */
const getHour = timestamp => getTime(set(timestamp, { minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Returns the nearest and lower 4 hours range of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the nearest and lower 4 hours range
 */
const get4Hour = timestamp => {
  const hours = getHours(timestamp)
  const fourHour = Math.floor(hours / 4) * 4
  return getTime(set(timestamp, { hours: fourHour, minutes: 0, seconds: 0, milliseconds: 0 }))
}

/**
 * Returns the floored day of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored day
 */
const getDay = timestamp => getTime(set(timestamp, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Returns the floored week of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored week
 */
const getWeek = timestamp => getTime(set(setDay(timestamp, 1, { weekStartsOn: 1 }), { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Returns the floored month of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored month
 */
const getMonth = timestamp => getTime(set(timestamp, { date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Returns the floored year of a given timestamp
 * @param {Number} timestamp - a date in a timestamp format
 * @returns {Number} a timestamp of the floored year
 */
const getYear = timestamp => getTime(set(timestamp, { month: 0, date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 }))

/**
 * Get the OCHL (open, close, high, low) prices from an array of orders
 * @param {Array<Object>} orders - background script orders
 * @returns {Object} an object with the computed open, close, high, low prices
 */
const getOCHL = orders => {
  if (orders.length === 1) {
    const price = orders[0].price.toFixed(2)
    return { open: price, close: price, high: price, low: price }
  } else {
    const open = minBy(orders, o => o.timestamp).price.toFixed(2)
    const close = maxBy(orders, o => o.timestamp).price.toFixed(2)
    const high = maxBy(orders, o => o.price.toFixed()).price.toFixed(2)
    const low = minBy(orders, o => o.price.toFixed()).price.toFixed(2)
    return { open, close, high, low }
  }
}

/**
 * Compute OCHL prices for the given orders, according to the timerange function
 * This timerange function is picked by index, this index coming from the PriceSticks chart
 * @param {Array<Object>} orders - background script orders
 * @param {Number} functionIndex - index of the timerange fuction to pick
 * @returns {Array<Object>} an array of object with timerange timestamp and OCHL prices
 */
export const computeOCHL = (orders, functionIndex) => {
  const functionToCall = [getQuarterHour, getHour, get4Hour, getDay, getWeek, getMonth, getYear][functionIndex]
  const range = groupBy(orders, o => functionToCall(o.timestamp))
  return Object.keys(range).map(x => ({ x: parseInt(x, 10), ...getOCHL(range[x]) }))
}
