const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}

const getNewMetaBatchEvent = receipt => {
  return receipt.logs.find(l => l.event === 'NewMetaBatch').args
}

const getNewBatchEvent = receipt => {
  return receipt.logs.find(l => l.event === 'NewBatch').args
}

const getBuyOrderBatchId = receipt => {
  const event = receipt.logs.find(l => l.event === 'OpenBuyOrder')
  return event.args.batchId
}

const getSellOrderBatchId = receipt => {
  const event = receipt.logs.find(l => l.event === 'OpenSellOrder')
  return event.args.batchId
}

module.exports = {
  getEvent,
  getNewMetaBatchEvent,
  getNewBatchEvent,
  getBuyOrderBatchId,
  getSellOrderBatchId,
}
