const tconfig = require('@aragon/os/truffle-config')

tconfig.solc.optimizer.runs = 3000

module.exports = tconfig
