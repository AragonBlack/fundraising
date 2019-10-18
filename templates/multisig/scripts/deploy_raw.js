const { hash: namehash } = require('eth-ens-namehash')
const deployDAOFactory = require('@aragon/os/scripts/deploy-daofactory')
const ENS = artifacts.require('ENS')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const TokenMock = artifacts.require('TokenMock')
const FundraisingMultisigTemplate = artifacts.require('FundraisingMultisigTemplate')

const aragonIDHash = namehash('aragonid.eth')

module.exports = async callback => {
  try {
    if (process.argv[4] === 'rpc') {
      const dai = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 100000e18, 'DAI', 'DAI')
      const ant = await TokenMock.new('0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 100000e18, 'ANT', 'ANT')
      const ens = '0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1'
      const owner = '0xb4124ceb3451635dacedd11767f004d8a28c6ee7'
      const ensRegistry = await ENS.at(ens)
      const aragonId = await ensRegistry.owner(aragonIDHash)
      const { daoFactory } = await deployDAOFactory(null, { artifacts: artifacts, owner, verbose: false })
      const miniMeFactory = await MiniMeTokenFactory.new()
      const template = await FundraisingMultisigTemplate.new(daoFactory.address, ens, miniMeFactory.address, aragonId, dai.address, ant.address)
      console.log(template.address)
    } else if (process.argv[4] === 'rinkeby') {
      const owner = '0x9b1B224E0445243eF5fD102114d15136967FfB15'
      const ens = '0x98Df287B6C145399Aaa709692c8D308357bC085D'
      const daoFactory = '0xfdef49fbfe37704af55636bdd4b6bc8cd19143f6'
      const miniMeFactory = '0x6ffeb4038f7f077c4d20eaf1706980caec31e2bf'
      const aragonId = '0x3665e7bfd4d3254ae7796779800f5b603c43c60d'
      const ANT = '0x0d5263b7969144a852d58505602f630f9b20239d'
      const DAI = '0x0527e400502d0cb4f214dd0d2f2a323fc88ff924'
      const template = await FundraisingMultisigTemplate.new(daoFactory, ens, miniMeFactory, aragonId, DAI, ANT, { from: owner })
      console.log(template.address)
    } else {
      throw new Error('Unknown network: pick rpc or rinkeby')
    }
  } catch (err) {
    console.log(err)
  }

  callback()
}
