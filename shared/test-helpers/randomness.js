const PCT_BASE = 1000000000000000000

const randomAmount = () => {
  return new web3.BigNumber(Math.floor(Math.random() * 10 + 1) * Math.pow(10, 18))
}

const randomVirtualSupply = () => {
  return Math.floor(Math.random() * Math.pow(10, 18)) + 1
}

const randomVirtualBalance = () => {
  return Math.floor(Math.random() * Math.pow(10, 18)) + 1
}

const randomReserveRatio = () => {
  return Math.floor(Math.random() * 999999) + 1
}

const randomSlippage = () => {
  return Math.floor(Math.random() * PCT_BASE) + 1
}

const randomRate = () => {
  return Math.floor(Math.random() * 999) + 1
}

const randomFloor = () => {
  return Math.floor(Math.random() * 999999) + 1
}

const randomFee = () => {
  return Math.floor(Math.random() * Math.pow(10, 17)) + 1
}

module.exports = {
  randomAmount,
  randomVirtualSupply,
  randomVirtualBalance,
  randomReserveRatio,
  randomSlippage,
  randomRate,
  randomFloor,
  randomFee,
}
