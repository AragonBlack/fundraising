const truffle = require('@aragon/os/truffle-config')

const gasLimit = 7e6 - 1

truffle.solc.optimizer.runs = 1
truffle.networks.rpc.gas = gasLimit
truffle.networks.devnet.gas = gasLimit
truffle.networks.rinkeby.gas = gasLimit
truffle.networks.ropsten.gas = gasLimit
truffle.networks.kovan.gas = gasLimit
truffle.networks.frame = {
  host: 'localhost',
  port: '1248',
  network_id: '*',
  gas: gasLimit,
  gasPrice: 15000000001,
}

module.exports = truffle
