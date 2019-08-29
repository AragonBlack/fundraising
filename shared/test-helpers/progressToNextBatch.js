const increaseBlock = web3 => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync(
      {
        jsonrpc: '2.0',
        method: 'evm_mine',
        id: 12345,
      },
      (err, result) => {
        if (err) reject(err)
        resolve(result)
      }
    )
  })
}

const increaseBlocks = (web3, blocks) => {
  if (typeof blocks === 'object') {
    blocks = blocks.toNumber(10)
  }
  return new Promise((resolve, reject) => {
    increaseBlock(web3).then(() => {
      blocks -= 1
      if (blocks === 0) {
        resolve()
      } else {
        increaseBlocks(web3, blocks).then(resolve)
      }
    })
  })
}

const progressToNextBatch = (web3, BATCH_BLOCKS) => async () => {
  const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)

  const currentBlock = await blockNumber()
  const currentBatch = Math.floor(currentBlock / BATCH_BLOCKS) * BATCH_BLOCKS
  const blocksUntilNextBatch = currentBatch + BATCH_BLOCKS - currentBlock
  await increaseBlocks(web3, blocksUntilNextBatch)
}

module.exports = progressToNextBatch
