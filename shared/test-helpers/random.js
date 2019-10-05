const { PCT_BASE } = require('./constants')

module.exports = {
  amount: () => {
    return new web3.BigNumber(Math.floor(Math.random() * 10 + 1) * Math.pow(10, 18))
  },

  virtualSupply: () => {
    return Math.floor(Math.random() * Math.pow(10, 18)) + 1
  },

  virtualBalance: () => {
    return Math.floor(Math.random() * Math.pow(10, 18)) + 1
  },

  reserveRatio: () => {
    return Math.floor(Math.random() * 999999) + 1
  },

  slippage: () => {
    return Math.floor(Math.random() * PCT_BASE) + 1
  },

  rate: () => {
    return Math.floor(Math.random() * 999) + 1
  },

  floor: () => {
    return Math.floor(Math.random() * 999999) + 1
  },

  fee: () => {
    return Math.floor(Math.random() * Math.pow(10, 17)) + 1
  },
}
