const {
  FUNDING_GOAL,
  CONNECTOR_WEIGHT,
  PERCENT_SUPPLY_OFFERED,
  PPM
} = require('./constants')
const sha3 = require('js-sha3').keccak_256

const utils = {

  getEvent: (tx, eventName) => tx.logs.filter(log => log.event.includes(eventName))[0],

  contributionToProjectTokens: (dai) => {
    return dai * utils.tokenExchangeRate()
  },

  now: () => {
    return Math.floor(new Date().getTime() / 1000)
  },

  tokenExchangeRate: () => {
    const connectorWeightDec = CONNECTOR_WEIGHT / PPM;
    const supplyOfferedDec = PERCENT_SUPPLY_OFFERED / PPM;
    return Math.floor(
      (FUNDING_GOAL / connectorWeightDec) * supplyOfferedDec
    )
  },

  sendTransaction: (data) => {
    return new Promise((resolve, reject) => {
      web3.eth.sendTransaction(data, (err, txHash) => {
        if(err) reject(err)
        else resolve(txHash)
      })
    })
  }
}

module.exports = utils
