module.exports = (web3, BATCH_BLOCKS) => async () => {
  const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
  const increaseBlocks = require('./increaseBlocks')(web3)
  const currentBlock = await blockNumber()
  const currentBatch = Math.floor(currentBlock / BATCH_BLOCKS) * BATCH_BLOCKS
  const blocksUntilNextBatch = currentBatch + BATCH_BLOCKS - currentBlock
  await increaseBlocks(blocksUntilNextBatch)
}
