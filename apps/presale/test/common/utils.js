const { PRESALE_GOAL, RESERVE_RATIOS, PERCENT_SUPPLY_OFFERED, PPM } = require('@ablack/fundraising-shared-test-helpers/constants')

const utils = {
  getEvent: (tx, eventName) => tx.logs.filter(log => log.event.includes(eventName))[0],

  contributionToProjectTokens: dai => {
    return dai * utils.tokenExchangeRate()
  },

  now: () => {
    return Math.floor(new Date().getTime() / 1000)
  },

  tokenExchangeRate: () => {
    const connectorWeightDec = RESERVE_RATIOS[0] / PPM
    const supplyOfferedDec = PERCENT_SUPPLY_OFFERED / PPM
    return Math.floor((PRESALE_GOAL / connectorWeightDec) * supplyOfferedDec)
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
