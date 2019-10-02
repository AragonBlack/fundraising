const Kernel = artifacts.require('Kernel')
const abi = require('web3-eth-abi')
const { hash: namehash } = require('eth-ens-namehash')

const APPS = [
  { name: 'agent', contractName: 'Agent' },
  { name: 'aragon-fundraising', contractName: 'AragonFundraisingController' },
  { name: 'bancor-formula', contractName: 'BancorFormula' },
  { name: 'batched-bancor-market-maker', contractName: 'BatchedBancorMarketMaker' },
  { name: 'finance', contractName: 'Finance' },
  { name: 'presale', contractName: 'Presale' },
  { name: 'vault', contractName: 'Vault' },
  { name: 'voting', contractName: 'Voting' },
  { name: 'tap', contractName: 'Tap' },
  { name: 'token-manager', contractName: 'TokenManager' },
]

const APP_IDS = APPS.reduce((ids, { name }) => {
  ids[name] = namehash(`${name}.aragonpm.eth`)
  return ids
}, {})

const decodeEvents = ({ receipt }, contractAbi, eventName) => {
  const eventAbi = contractAbi.filter(abi => abi.name === eventName && abi.type === 'event')[0]
  const eventSignature = abi.encodeEventSignature(eventAbi)
  const eventLogs = receipt.logs.filter(l => l.topics[0] === eventSignature)
  return eventLogs.map(log => {
    log.event = eventAbi.name
    log.args = abi.decodeLog(eventAbi.inputs, log.data, log.topics.slice(1))
    return log
  })
}

const getInstalledApps = (receipt, appId) => {
  const events = decodeEvents(receipt, Kernel.abi, 'NewAppProxy')
  const appEvents = events.filter(e => e.args.appId === appId)
  const installedAddresses = appEvents.map(e => e.args.proxy)
  return installedAddresses
}

const getInstalledAppsById = receipt => {
  return Object.keys(APP_IDS).reduce((apps, appName) => {
    apps[appName] = getInstalledApps(receipt, APP_IDS[appName])
    return apps
  }, {})
}

module.exports = {
  APP_IDS,
  getInstalledAppsById,
}
