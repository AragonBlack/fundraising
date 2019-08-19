const { hash: namehash } = require('eth-ens-namehash')
const deployDAOFactory = require('@aragon/os/scripts/deploy-daofactory')
const ENS = artifacts.require('ENS')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const FundraisingMultisigTemplate = artifacts.require('FundraisingMultisigTemplate')

const aragonIDHash = namehash('aragonid.eth')
const ens = '0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1'
const owner = '0xb4124ceb3451635dacedd11767f004d8a28c6ee7'

module.exports = async callback => {
  try {
    const ensRegistry = await ENS.at(ens)
    const aragonId = await ensRegistry.owner(aragonIDHash)
    const { daoFactory } = await deployDAOFactory(null, { artifacts: artifacts, owner, verbose: false })
    const miniMeFactory = await MiniMeTokenFactory.new()
    const template = await FundraisingMultisigTemplate.new(daoFactory.address, ens, miniMeFactory.address, aragonId)

    console.log(template.address)
  } catch (err) {
    console.log(err)
  }

  callback()
}
