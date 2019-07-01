require('dotenv').config({ path: '../.env' })
const path = require('path')
const FundraisingKit = artifacts.require('FundraisingKit')
const TokenMock = artifacts.require('TokenMock')
const pct16 = x =>
  new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))
const getEventResult = (receipt, event, param) =>
  receipt.logs.filter(l => l.event == event)[0].args[param]

// Ensure that these address are up to date according to the network
// Defaults set here are for the local rpc
const defaultOwner = process.env.OWNER || '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7'
const defaultFundraisingKitAddr = process.env.FUNDRAISING_KIT || process.argv[6]
const defaultENSAddress = process.env.ENS || '0x5f6f7e8cc7346a11ca2def8f827b7a0b612c56a1'
const defaultHolders = [defaultOwner, '0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb']

const getDeployedKit = async address => {
  return await FundraisingKit.at(address)
}

// TODO: paramertize the script to accept information needed for the tokens, voting app, etc.
module.exports = async (
  callback,
  { owner = defaultOwner, fundraisingKitAddr = defaultFundraisingKitAddr, initialHolders = defaultHolders, tokenSupply = 1000000000000000000 }
) => {
  console.log(`Creating token instances with owner: ${owner} and supply: ${tokenSupply}`)
  const multisigToken = await TokenMock.new(owner, tokenSupply)
  const bondedToken = await TokenMock.new(owner, tokenSupply)
  console.log(`Collateral tokens deployed @ ${collateral1.address} and ${collateral2.address}`)

  if (fundraisingKitAddr) {
    console.log('Creating kit instance at ', fundraisingKitAddr)
  } else {
    // Retrieve the lastest version from APM
  }

  const kit = getDeployedKit(fundraisingKitAddr)
  console.log('Kit instance created')

  const receiptTokens = await kit.newTokens('PRO', 'PROJECT')
  const receiptMultisig = await kit.newMultisigInstance(
    'fundraising' + Math.random(),
    initialHolders,
    2
  )
  const receiptDao = await kit.newFundraisingInstance(multisigToken.address, bondedToken.address)

  const daoAddress = getEventResult(receiptDao, 'DeployFundraising', 'dao')
  const cacheAddress = getEventResult(receiptMultisig, 'DeployMultisigInstance', 'dao') // multisig.dao === dao
  const bondedTokenAddress = getEventResult(bondedToken, 'DeployToken', 'token')
  const multisigTokenAddress = getEventResult(multisigToken, 'DeployToken', 'token')

  // Installed apps
  const controllerAddress = getEventResult(receiptDao, 'DeployInstance', 'fundraising-controller-aragon-fundraising')
  const bancorAddress = getEventResult(receiptDao, 'DeployInstance', 'fundraising-formula-bancor')
  const marketMakerAddress = getEventResult(receiptDao, 'DeployInstance', 'fundraising-market-maker-bancor')
  const bondedVotingAddress = getEventResult(receiptDao, 'DeployInstance', 'voting')
  const bondedTokenManagerAddress = getEventResult(receiptDao, 'DeployInstance', 'token-manager')
  const tapAddress = getEventResult(receiptDao, 'DeployInstance', 'fundraising-module-tap')
  const poolAddress = getEventResult(receiptDao, 'DeployInstance', 'pool')
  const votingAddress = getEventResult(receiptDAO, 'DeployInstance', 'voting')

  // Multisig DAO configuration
  const tokenManagerAddress = getEventResult(receiptMultisig, 'DeployInstance', 'token-manager')
  const financeAddress = getEventResult(receiptMultisig, 'DeployInstance', 'finance')
  const vaultAddress  = getEventResult(receiptMultisig, 'DeployInstance', 'vault')
  const votingMultisigAddress = getEventResult(receiptMultisig, 'DeployInstance', 'voting')

  if (daoAddress === cacheAddress) {
    console.log('DAO deployed at ' + dao)
  } else {
    throw new Error('Setting up the DAO cache failed')
  }

  console.log('DAO Created:', daoAddress)
  console.log('TokenManager (curve-bonded) Address:', bondedTokenManagerAddress)
  console.log('Voting (curve-bonded) Address:', bondedVotingAddress)
  console.log('Market Maker Address:', marketMakerAddress)
  console.log('BancorFormula Address:', bancorAddress)
  console.log('Pool Address:', poolAddres)
  console.log('Tap Address:', tapAddress)
  console.log('Finance Address:', financeAddress)
  console.log('Vault Address:', vaultAddress)
  console.log('Voting (curve-bonded) Address:', votingAddress)
  console.log('Voting (multisig) Address:', votingMultisigAddress)

  callback()
}
