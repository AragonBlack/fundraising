const { PRESALE_GOAL, RESERVE_RATIOS, PERCENT_SUPPLY_OFFERED, PPM } = require('@ablack/fundraising-shared-test-helpers/constants')

const utils = {
  getEvent: (tx, eventName) => tx.logs.filter(log => log.event.includes(eventName))[0],

  contributionToProjectTokens: value => {
    return (web3.toBigNumber(value)).mul(utils.tokenExchangeRate())
  },

  now: () => {
    return Math.floor(new Date().getTime() / 1000)
  },

  tokenExchangeRate: () => {
    const ppm = web3.toBigNumber(PPM, 10)
    const presaleGoal = web3.toBigNumber(PRESALE_GOAL, 10)
    const reserveRatio = web3.toBigNumber(RESERVE_RATIOS[0], 10)
    const supplyOffered = web3.toBigNumber(PERCENT_SUPPLY_OFFERED, 10)
    return presaleGoal.mul(ppm).mul(supplyOffered).div(reserveRatio).div(ppm)
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
