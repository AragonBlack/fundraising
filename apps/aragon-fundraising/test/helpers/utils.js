const { ETH } = require('@ablack/fundraising-shared-test-helpers/constants')
const allEvents = require('web3/lib/web3/allevents')

const now = () => {
  return Math.floor(new Date().getTime() / 1000)
}

const decodeEventsForContract = (contract, receipt) => {
  const ae = new allEvents(contract._web3, contract.abi, contract.address)

  return JSON.parse(JSON.stringify(receipt))
    .logs.filter(l => l.address === contract.address)
    .map(l => ae.decode(l))
}

const getBuyOrderBatchId = (ctx, tx) => {
  const events = decodeEventsForContract(ctx.marketMaker, tx.receipt)
  const event = events.filter(l => {
    return l.event === 'OpenBuyOrder'
  })[0]

  return event.args.batchId
}

const getSellOrderBatchId = (ctx, tx) => {
  const events = decodeEventsForContract(ctx.marketMaker, tx.receipt)
  const event = events.filter(l => {
    return l.event === 'OpenSellOrder'
  })[0]

  return event.args.batchId
}

const openAndClaimBuyOrder = (web3, BATCH_BLOCKS) => async (ctx, collateral, amount, { from } = {}) => {
  const progressToNextBatch = require('@ablack/fundraising-shared-test-helpers/progressToNextBatch')(web3, BATCH_BLOCKS)
  // create buy order
  const receipt = await ctx.controller.openBuyOrder(collateral, amount, { from, value: collateral === ETH ? amount : 0 })
  const batchId = getBuyOrderBatchId(ctx, receipt)
  // move to next batch
  await progressToNextBatch()
  // claim bonds
  await ctx.controller.claimBuyOrder(from, batchId, collateral, { from })
  // return balance
  const balance = await ctx.token.balanceOf(from)

  return balance
}

module.exports = {
  now,
  getBuyOrderBatchId,
  getSellOrderBatchId,
  openAndClaimBuyOrder,
}
