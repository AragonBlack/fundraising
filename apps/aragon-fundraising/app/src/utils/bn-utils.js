import BigNumber from 'bignumber.js'

/**
 * Converts a tap rate to its monthly rate
 * @param {String|Number|BigNumber} value - value to convert
 * @param {Number} decimals - decimals of the value to convert
 * @returns {BigNumber} the converted value
 */
export const toMonthlyAllocation = (value, decimals) => {
  return new BigNumber(value).times(4 * 60 * 24 * 30)
}

/**
 * Converts a monthly rate to its tap rate (wei/block)
 * @param {String|Number|BigNumber} value - value to convert
 * @param {Number} decimals - decimals of the value to convert
 * @returns {BigNumber} the converted value
 */
export const fromMonthlyAllocation = (value, decimals) => {
  return toDecimals(value, decimals).div(4 * 60 * 24 * 30)
}

/**
 * Converts a "human" value to it's decimal one
 * @param {String|Number|BigNumber} value - value to convert
 * @param {Number} decimals - decimals of the value to convert
 * @returns {BigNumber} the converted value
 */
export const toDecimals = (value, decimals) => {
  return new BigNumber(value).shiftedBy(decimals)
}

/**
 * Converts a decimal value to it's "human" one
 * @param {String|Number|BigNumber} value - value to convert
 * @param {Number} decimals - decimals of the value to convert
 * @returns {BigNumber} the converted value
 */
export const fromDecimals = (value, decimals) => {
  return new BigNumber(value).shiftedBy(-decimals)
}

/**
 * Formats a big number to be a readable value
 * @see https://mikemcl.github.io/bignumber.js/#rounding-mode for rm
 * @param {String|Number|BigNumber} value - value to format
 * @param {Number} decimals - decimals of the value to format
 * @param {Object} opts - configuration options
 * @param {Number} opts.dp - how many decimals do we keep on the formatted value, default 2
 * @param {Number} opts.rm - how to round value, default to ROUND_DOWN
 * @param {Boolean} opts.keepSign - if false, only "-" sign will be kept, if true, "+" and "-" will be kept
 * @param {String} opts.numberPrefix - prefix to put between sign (if kept) and number, default ''
 * @param {String} opts.numberSuffix - suffix to put at the end, default ''
 * @returns {String} the formatted value
 */
export const formatBigNumber = (value, decimals, { dp = 2, rm = 1, keepSign = false, numberPrefix = '', numberSuffix = '' } = {}) => {
  const valueDecimals = fromDecimals(value, decimals)
  const sign = valueDecimals.isPositive() ? '+' : '-'
  const prefix = keepSign ? `${sign}${numberPrefix}` : `${numberPrefix}`
  return `${prefix}${valueDecimals.abs().toFormat(dp, rm)}${numberSuffix}`
}
