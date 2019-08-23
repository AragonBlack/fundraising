const truffle = require('@aragon/os/truffle-config')
truffle.solc.optimizer.runs = 3000
truffle.networks.rpc.gas = 6.9e6
truffle.networks.frame = {
  host: 'localhost', // Frame
  port: '1248', // Frame
  network_id: 4,
  gas: 6.9e6,
  gasPrice: 15000000001,
}
module.exports = truffle
