import BigNumber from 'bignumber.js'

/**
 * Formats a big number to be a readable value
 * @see https://mikemcl.github.io/bignumber.js/#rounding-mode for roundingMode
 * @param {String|Number|BigNumber} value - value to format
 * @param {Number} decimals - decimals of the value to format
 * @param {Number} decimalPlaces - how many decimals do we keep on the formatted value
 * @param {Number} roundingMode - how to round value, default to ROUND_HALF_UP
 * @returns {String} the formatted value
 */
export const formatBigNumber = (value, decimals, decimalPlaces = 2, roundingMode = 1) => {
  return new BigNumber(value).shiftedBy(-decimals).toFormat(decimalPlaces, roundingMode)
}

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
