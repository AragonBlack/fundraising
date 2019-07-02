const FundraisingKit = artifacts.require('FundraisingKit')
const TokenMock = artifacts.require('TokenMock')
const Controller = artifacts.require('AragonFundraisingController')

const getBuyOrderBatchId = receipt => {
  const event = receipt.logs.find(l => l.event === 'NewBuyOrder')
  return event.args.batchId
}

function increaseBlock() {
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

function increaseBlocks(blocks) {
  if (typeof blocks === 'object') {
    blocks = blocks.toNumber(10)
  }
  return new Promise((resolve, reject) => {
    increaseBlock().then(() => {
      blocks -= 1
      if (blocks === 0) {
        resolve()
      } else {
        increaseBlocks(blocks).then(resolve)
      }
    })
  })
}

module.exports = async callback => {
  try {
    const collateral1 = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 1000000000000000000)
    const collateral2 = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 1000000000000000000)

    const kit = await FundraisingKit.at(process.argv[6])

    const receipt1 = await kit.newTokens('PRO', 'PROJECT')
    const receipt2 = await kit.newMultisigInstance(
      'fundraising' + Math.random(),
      ['0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', '0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb '],
      2
    )
    const receipt3 = await kit.newFundraisingInstance(collateral1.address, collateral2.address)
    const dao = receipt2.logs.filter(l => l.event == 'DeployMultisigInstance')[0].args.dao

    const controllerAddress = receipt3.logs.filter(
      l => l.event === 'InstalledApp' && l.args.appId === '0xc48aa5a969ae8dcd08a42cd12dce8c3c494c4ba70eb0d3bef069f20469e04be1'
    )[0].args.appProxy

    const marketMakerAddress = receipt3.logs.filter(
      l => l.event === 'InstalledApp' && l.args.appId === '0xd9f5fb0b31c6211801549521bac548c25cc14dce610e5e4c4ea2857ac4580d05'
    )[0].args.appProxy

    console.log(controllerAddress)
    console.log(marketMakerAddress)

    const controller = await Controller.at(controllerAddress)

    console.log('OK')

    await collateral1.approve(marketMakerAddress, 1000000000000000000)

    const receipt4 = await controller.createBuyOrder(collateral1.address, 10000)

    // const batchId = getBuyOrderBatchId(receipt4)

    await increaseBlocks(1)

    // const receipt = await curve.createBuyOrder(authorized, ETH, amount, { from: authorized, value: amount })

    console.log('DAO deployed at ' + dao)

    callback()
  } catch (err) {
    console.log(err)
    callback(undefined, err)
  }
}
