require('dotenv').config({ path: './node_modules/@aragon/kits-beta-base/.env' })
const getContract = name => artifacts.require(name)
const getKit = (indexObj, kitName) => getContract(kitName).at(indexObj.environments['devnet'].address)
const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))

contract('Fundraising Kit', accounts => {
  let kit

  const owner = process.env.OWNER //'0x1f7402f55e142820ea3812106d0657103fc1709e'
  const signer1 = accounts[6]
  const signer2 = accounts[7]
  const signer3 = accounts[8]
  let indexObj = require('../arapp_local.json')

  context('Use Kit', async () => {
    before(async () => {
      console.log(indexObj.environments['devnet'])
      kit = await getKit(indexObj, 'FundraisingKit')
    })

    it('create token', async () => {
      await kit.newTokens('FundraisingToken', 'FRT', { from: owner })
    })

    it('create new multisig instance', async () => {
      const signers = [signer1, signer2, signer3]
      const neededSignatures = 2
      console.log(signers)
      await kit.newMultisigInstance('FundraisingDao-' + Math.random() * 1000, signers, 2, { from: owner })
    })

    it('install fundraising apps', async () => {
      await kit.newFundraisingInstance({ from: owner })
    })
  })
})
