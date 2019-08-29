const ETH = '0x0000000000000000000000000000000000000000'

module.exports = (web3, TokenMock) => async (collateral, address) => {
  if (collateral === ETH) {
    return web3.eth.getBalance(address)
  } else {
    const token = await TokenMock.at(collateral)
    return token.balanceOf(address)
  }
}
