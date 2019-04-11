module.exports = {
  networks: {
    rpc: {
      host: "localhost",
      port: 8545,
      network_id: 15,
      gas: 6.9e6,
      gasPrice: 15000000001
    },
    devchain: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 6.9e6,
      gasPrice: 15000000001
    }
  },
  compilers: {
    solc: {
      version: "0.4.24",
      optimizer: {
        enabled: true,
        runs: 10000
      }
    }
  }
};
