const truffle = require('@aragon/os/truffle-config')
truffle.solc.optimizer.runs = 3000
module.exports = truffle
