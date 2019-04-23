const mochaGasSettings = {
  reporter: 'eth-gas-reporter',
  reporterOptions: {
    currency: 'USD',
    gasPrice: 3,
  },
}

const mocha = process.env.GAS_REPORTER ? mochaGasSettings : {}

module.exports = {
  networks: {
    rpc: {
      host: 'localhost',
      port: 8545,
      network_id: 15,
      gas: 7.9e6,
      gasPrice: 15000000001,
    },
    devchain: {
      host: 'localhost',
      port: 8545,
      network_id: '*',
      gas: 6.9e6,
      gasPrice: 15000000001,
    },
  },
  mocha,
  compilers: {
    solc: {
      version: '0.4.24',
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
}
