const PPM = 1e6
const PCT_BASE = 1e18

const INITIAL_ETH_BALANCE = 100000000

const VIRTUAL_SUPPLIES = [new web3.BigNumber(Math.pow(10, 23)), new web3.BigNumber(Math.pow(10, 22))]
const VIRTUAL_BALANCES = [new web3.BigNumber(Math.pow(10, 22)), new web3.BigNumber(Math.pow(10, 20))]
const RESERVE_RATIOS = [(PPM * 10) / 100, (PPM * 1) / 100]
const SLIPPAGES = [10 * PCT_BASE, 15 * PCT_BASE]
const RATES = [10, 15]
const FLOORS = [1000, 5000]

module.exports = {
  INITIAL_ETH_BALANCE,
  PPM,
  PCT_BASE,
  VIRTUAL_SUPPLIES,
  VIRTUAL_BALANCES,
  RESERVE_RATIOS,
  SLIPPAGES,
  RATES,
  FLOORS,
}
