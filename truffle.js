module.exports = {
  networks: {
    devchain: {
      host: "localhost",
      port: 8545,
      network_id: "*",
      gas: 8e6,
      gasPrice: 1500000000
    }
  },
  compilers: {
    solc: {
      version: "0.4.24"
    }
  }
};
