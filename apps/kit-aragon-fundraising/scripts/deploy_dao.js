const FundraisingKit = artifacts.require('FundraisingKit')
const TokenMock = artifacts.require('TokenMock')

const deploy = async address => {
  const kit = await FundraisingKit.at(address)

  console.log('tata')
}

module.exports = async callback => {
  const kit = await FundraisingKit.at(process.argv[6])
  console.log(kit.address)

  const receipt1 = await kit.newTokens('BONDS', 'BONDS')

  console.log(receipt1)

  const receipt2 = await kit.newMultisigInstance(
    'fundraising' + Math.random(),
    ['0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', '0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb '],
    2
  )

  console.log(receipt2.logs)

  const collateral1 = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 1000000000000000000)
  const collateral2 = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 1000000000000000000)

  console.log(collateral1.address)
  console.log(collateral2.address)

  const receipt3 = await kit.newFundraisingInstance(collateral1.address, collateral2.address)

  //   console.log(receipt3)

  //   console.log(receipt3.logs)

  callback()
}
