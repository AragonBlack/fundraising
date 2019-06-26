const FundraisingKit = artifacts.require('FundraisingKit')
const TokenMock = artifacts.require('TokenMock')

const deploy = async address => {
  const kit = await FundraisingKit.at(address)

  console.log('tata')
}

module.exports = async callback => {
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

  console.log('DAO deployed at ' + dao)

  callback()
}
