const { PRESALE_GOAL, PRESALE_EXCHANGE_RATE, RESERVE_RATIOS, PERCENT_SUPPLY_OFFERED, PPM } = require('@ablack/fundraising-shared-test-helpers/constants')

const utils = {
  getEvent: (tx, eventName) => tx.logs.filter(log => log.event.includes(eventName))[0],

  contributionToProjectTokens: value => {
    return web3.toBigNumber(value).mul(utils.tokenExchangeRate())
  },

  now: () => {
    return Math.floor(new Date().getTime() / 1000)
  },

  tokenExchangeRate: () => {
    return PRESALE_EXCHANGE_RATE
  },

  sendTransaction: data => {
    return new Promise((resolve, reject) => {
      web3.eth.sendTransaction(data, (err, txHash) => {
        if (err) reject(err)
        else resolve(txHash)
      })
    })
  },
}

module.exports = utils
