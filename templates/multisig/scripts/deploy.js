const deployTemplate = require('@aragon/templates-shared/scripts/deploy-template')

const TEMPLATE_NAME = 'fundraising-multisig-template'
const CONTRACT_NAME = 'FundraisingMultisigTemplate'

const APPS = [
  { name: 'agent', contractName: 'Agent' },
  { name: 'token-manager', contractName: 'TokenManager' },
  { name: 'voting', contractName: 'Voting' },
  { name: 'vault', contractName: 'Vault' },
  { name: 'finance', contractName: 'Finance' },
  { name: 'bancor-formula', contractName: 'BancorFormula' },
  { name: 'batched-bancor-market-maker', contractName: 'BatchedBancorMarketMaker' },
  { name: 'tap', contractName: 'Tap' },
  { name: 'aragon-fundraising', contractName: 'AragonFundraisingController' },
]

module.exports = callback => {
  deployTemplate(web3, artifacts, TEMPLATE_NAME, CONTRACT_NAME, APPS)
    .then(template => {
      console.log(template.address)
      callback()
    })
    .catch(callback)
}
