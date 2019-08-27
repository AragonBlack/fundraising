const { hash: namehash } = require('eth-ens-namehash')
const deployDAOFactory = require('@aragon/os/scripts/deploy-daofactory')
const ENS = artifacts.require('ENS')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const FundraisingMultisigTemplate = artifacts.require('FundraisingMultisigTemplate')
const FundraisingMultisigTemplateHatch = artifacts.require('FundraisingMultisigTemplateHatch')

const aragonIDHash = namehash('aragonid.eth')

module.exports = async callback => {
  try {
    if (process.argv[4] === 'rpc') {
      const ens = '0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1'
      const owner = '0xb4124ceb3451635dacedd11767f004d8a28c6ee7'
      const ensRegistry = await ENS.at(ens)
      const aragonId = await ensRegistry.owner(aragonIDHash)
      const { daoFactory } = await deployDAOFactory(null, { artifacts: artifacts, owner, verbose: false })
      const miniMeFactory = await MiniMeTokenFactory.new()
      const template = await FundraisingMultisigTemplate.new(daoFactory.address, ens, miniMeFactory.address, aragonId)
      console.log(template.address)
    } else if (process.argv[4] === 'hatch') {
      const ens = '0x98Df287B6C145399Aaa709692c8D308357bC085D'
      const owner = '0xb71d2d88030a00830c3d45f84c12cc8aaf6857a5'
      const daoFactory = '0xfdef49fbfe37704af55636bdd4b6bc8cd19143f6'
      const miniMeFactory = '0x6ffeb4038f7f077c4d20eaf1706980caec31e2bf'
      const aragonId = '0x3665e7bfd4d3254ae7796779800f5b603c43c60d'
      const template = await FundraisingMultisigTemplateHatch.new(daoFactory, ens, miniMeFactory, aragonId, { from: owner })
    } else {
      throw new Error('Unknown network: pick rpc or hatch')
    }
  } catch (err) {
    console.log(err)
  }

  callback()
}
