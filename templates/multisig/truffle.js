const truffle = require('@aragon/os/truffle-config')
truffle.solc.optimizer.runs = 3000
truffle.networks.rpc.gas = 7.9e6
module.exports = truffle
