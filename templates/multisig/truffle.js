const tconfig = require('@aragon/os/truffle-config')

tconfig.solc.optimizer.runs = 3000
tconfig.networks.rpc.gas = 7.9e6

module.exports = tconfig
