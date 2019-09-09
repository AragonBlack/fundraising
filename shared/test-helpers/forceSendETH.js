const ForceSendETH = artifacts.require('ForceSendETH')

module.exports = async (to, value) => {
  // Using this contract ETH will be send by selfdestruct which always succeeds
  const forceSend = await ForceSendETH.new()
  return forceSend.sendByDying(to, { value })
}
