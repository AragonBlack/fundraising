require('dotenv').config({ path: '../.env' })
const path = require('path')
const namehash = require('eth-ens-namehash').hash
const FundraisingKit = artifacts.require('FundraisingKit')
const TokenMock = artifacts.require('TokenMock')
const pct16 = x =>
  new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))
const getEventResult = (receipt, event, param) => {
  if (event == 'InstalledApp') {
    return receipt.logs.filter(l => l.event == event).filter(e => e.args.appId === namehash(`${param}.aragonpm.eth`))[0].args.appProxy
  }
  return receipt.logs.filter(l => l.event == event)[0].args[param]
}

// Ensure that these address are up to date according to the network
// Defaults set here are for the local rpc
const defaultOwner = process.env.OWNER || '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7'
const defaultFundraisingKitAddr = process.argv[6]
const defaultENSAddress = process.env.ENS || '0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1'
const defaultHolders = [defaultOwner, '0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb']
const tokenSupply = 1000000000000000000
const getDeployedKit = async address => {
  return await FundraisingKit.at(address)
}

// TODO: paramertize the script to accept information needed for the tokens, voting app, etc.
module.exports = async callback => {
  console.log(`Creating token instances with owner: ${defaultOwner} and supply: ${tokenSupply}`)
  const multisigToken = await TokenMock.new(defaultOwner, tokenSupply)
  const bondedToken = await TokenMock.new(defaultOwner, tokenSupply)
  console.log(`Collateral tokens deployed: ${multisigToken.address} and ${bondedToken.address}`)

  console.log('Creating kit instance at', defaultFundraisingKitAddr)
  const kit = await getDeployedKit(defaultFundraisingKitAddr)
  console.log('Kit instance created')

  const receiptTokens = await kit.newTokens('PRO', 'PROJECT')
  const aragonId = 'fundraising' + Math.random()

  const receiptMultisig = await kit.newMultisigInstance(
    aragonId,
    defaultHolders,
    2
  )

  const receiptDao = await kit.newFundraisingInstance(multisigToken.address, bondedToken.address)

  const daoAddress = getEventResult(receiptDao, 'DeployFundraisingInstance', 'dao')
  const cacheAddress = getEventResult(receiptMultisig, 'DeployMultisigInstance', 'dao') // multisig.dao === dao
  const bondedTokenAddress = receiptTokens.logs.filter(l => l.event == 'DeployToken')[0].args.token
  const multisigTokenAddress = receiptTokens.logs.filter(l => l.event == 'DeployToken')[1].args.token
  if (daoAddress === cacheAddress) {
    console.log('DAO deployed at ' + daoAddress)
  } else {
    throw new Error('Setting up the DAO cache failed')
  }
  console.log('BondedToken Created:', bondedTokenAddress)
  console.log('MultisigToken Created:', multisigTokenAddress)

  // Installed apps
  const controllerAddress = getEventResult(receiptDao, 'InstalledApp', 'fundraising-controller-aragon-fundraising')
  console.log('Controller Created:', controllerAddress)

  const marketMakerAddress = getEventResult(receiptDao, 'InstalledApp', 'fundraising-market-maker-bancor')
  console.log('Market Maker Created:', marketMakerAddress)

  const poolAddress = getEventResult(receiptDao, 'InstalledApp', 'fundraising-module-pool')
  console.log('Pool Created:', poolAddress)

  const tapAddress = getEventResult(receiptDao, 'InstalledApp', 'fundraising-module-tap')
  console.log('Tap Created:', tapAddress)

  const bondedVotingAddress = getEventResult(receiptDao, 'InstalledApp', 'voting')
  console.log('Voting (curve-bonded) Created:', bondedVotingAddress)

  const bondedTokenManagerAddress = getEventResult(receiptDao, 'InstalledApp', 'token-manager')
  console.log('TokenManager (curve-bonded) Created:', bondedTokenManagerAddress)

  // Multisig DAO configuration
  const tokenManagerAddress = getEventResult(receiptMultisig, 'InstalledApp', 'token-manager')
  console.log('Token Manager (multisig) Created:', tokenManagerAddress)

  const financeAddress = getEventResult(receiptMultisig, 'InstalledApp', 'finance')
  console.log('Finance Created:', financeAddress)

  const vaultAddress  = getEventResult(receiptMultisig, 'InstalledApp', 'vault')
  console.log('Vault Created:', vaultAddress)

  const votingMultisigAddress = getEventResult(receiptMultisig, 'InstalledApp', 'voting')
  console.log('Voting (multisig) Created:', votingMultisigAddress)

  console.log('Finished!')

  // Test network environment and provide link
  const network = process.argv[5]

  if (network === 'rpc') {
    console.log('Start the Aragon client locally and go to:', daoAddress)
  } else { // Rinkeby only
    console.log('Visit your DAO at https://rinkeby.aragon.org/#/' + aragonId + '.aragonid.eth')
  }

  callback()
}
