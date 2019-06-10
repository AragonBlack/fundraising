require('dotenv').config({ path: '../.env' })
/* eslint-disable no-undef */

// Test Helpers
const getBlockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const getBlock = require('@aragon/test-helpers/block')(web3)
// const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const getBalance = require('@aragon/test-helpers/balance')(web3)
const namehash = require('eth-ens-namehash').hash
const keccak256 = require('js-sha3').keccak_256

const ENS = artifacts.require('ENS')
const PublicResolver = artifacts.require('PublicResolver')
const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistry = artifacts.require('EVMScriptRegistry')
const MiniMeTokenFactory = artifacts.require('MiniMeTokenFactory')
const Vault = artifacts.require('Vault')
const Finance = artifacts.require('Finance')
const TokenManager = artifacts.require('TokenManager')
const Voting = artifacts.require('Voting')
const Tap = artifacts.require('Tap')
const Pool = artifacts.require('Pool')
const BancorMarketMaker = artifacts.require('BancorMarketMaker')
const AragonFundraisingController = artifacts.require('AragonFundraisingController')
const FundraisingKit = artifacts.require('FundraisingKit')
const BancorFormula = artifacts.require('BancorFormula')

const apps = ['finance', 'token-manager', 'vault', 'voting']
const appIds = apps.map(app => namehash(require(`@aragon/apps-${app}/arapp`).environments.default.appName))

const fundraisingApps = ['fundraising-market-maker-bancor','fundraising-formula-bancor', 'fundraising-controller-aragon-fundraising', 'fundraising-module-tap', 'fundraising-module-pool']
const fundraisingAppIds = fundraisingApps.map(app => namehash(require(`@ablack/${app}/arapp`).environments.default.appName))

const getContract = name => artifacts.require(name)
const pct16 = x => new web3.BigNumber(x).times(new web3.BigNumber(10).toPower(16))
const getEventResult = (receipt, event, param) => receipt.logs.filter(l => l.event == event)[0].args[param]
const getVoteId = receipt => {
  const logs = receipt.receipt.logs.filter(l => l.topics[0] == web3.sha3('StartVote(uint256,address,string)'))

  return web3.toDecimal(logs[0].topics[1])
}
const getAppProxy = (receipt, id) => receipt.logs.filter(l => l.event == 'InstalledApp' && l.args.appId == id)[0].args.appProxy
const networks = require('@aragon/os/truffle-config').networks
const getNetwork = require('../../../helpers/networks.js')
const getKitConfiguration = async networkName => {
  let arappFilename = 'arapp'
  if (networkName == 'devnet' || networkName == 'rpc') {
      arappFilename = 'arapp_local'
  } else {
      arappFilename = 'arapp'
  }

  const arappFile = require('../' + arappFilename)
  const ensAddress = arappFile.environments[networkName].registry
  const ens = getContract('ENS').at(ensAddress)
  const kitEnsName = arappFile.environments[networkName].appName
  const repoAddr = await artifacts
    .require('PublicResolver')
    .at(await ens.resolver(namehash('aragonpm.eth')))
    .addr(namehash(kitEnsName))
  const repo = getContract('Repo').at(repoAddr)
  const kitAddress = (await repo.getLatest())[1]
  const kitContractName = arappFile.path
    .split('/')
    .pop()
    .split('.sol')[0]
  const kit = getContract(kitContractName).at(kitAddress)

  return { ens, kit }
}

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'
const NULL_ADDRESS = '0x00'

contract('FundraisingKit', accounts => {
  let daoAddress, tokenAddress

  let financeAddress, tokenManagerAddress, vaultAddress, votingAddress
  let finance, tokenManager, vault, voting

  let marketMakerAddress, controllerAddress, tapAddress, poolAddress
  let marketMaker, aragonFundraisingController, tap, pool

  let kit, receiptInstance

  const owner = accounts[0]
  const holder1 = accounts[1]
  const holder2 = accounts[2]
  const holder3 = accounts[3]
  const nonHolder = accounts[4]
  const holders = [holder1, holder2, holder3]

  // Voting
  const neededSupport = pct16(50)
  const minimumAcceptanceQuorum = pct16(20)
  const minParticipationPct = pct16(50)
  const candidateSupportPct = pct16(10)
  const votingTime = 60

  before(async () => {
    // create Fundraising  Kit
    const networkName = (await getNetwork(networks)).name
    if (networkName == 'devnet' || networkName == 'rpc') {
      // transfer some ETH to other accounts
      // await web3.eth.sendTransaction({ from: owner, to: holder1, value: web3.toWei(10, 'ether') })
      // await web3.eth.sendTransaction({ from: owner, to: holder2, value: web3.toWei(10, 'ether') })
      // await web3.eth.sendTransaction({ from: owner, to: holder3, value: web3.toWei(10, 'ether') })
      // await web3.eth.sendTransaction({ from: owner, to: nonHolder, value: web3.toWei(10, 'ether') })
    }
    const configuration = await getKitConfiguration(networkName)

    ens = configuration.ens
    kit = configuration.kit
  })

  const creationStyles = ['separate']
  for (const creationStyle of creationStyles) {
    context(`> Creation through ${creationStyle} transaction`, () => {
      let aragonId, tokenName, tokenSymbol

      before(async () => {
        aragonId = 'fundraising-' + Math.floor(Math.random() * 1000)
        tokenName = 'Fundraising Token'
        tokenSymbol = 'FUND'

        if (creationStyle === 'single') {
          // create token and instance
          receiptInstance = await kit.newTokenAndInstance(
            tokenName,
            tokenSymbol,
            aragonId,
            holders
          )
          tokenAddress = getEventResult(receiptInstance, 'DeployToken', 'token')
          daoAddress = getEventResult(receiptInstance, 'DeployInstance', 'dao')
        } else if (creationStyle === 'separate') {
          // create Token
          const receiptToken = await kit.newToken(tokenName, tokenSymbol)
          tokenAddress = getEventResult(receiptToken, 'DeployToken', 'token')
          //console.log(receiptToken)

          // create Instance
          receiptInstance = await kit.newInstance(
            aragonId,
            holders,
            { from: owner }
          )
        }

        // generated apps from dao creation
        financeAddress = getAppProxy(receiptInstance, appIds[0])
        finance = await Finance.at(financeAddress)
        tokenManagerAddress = getAppProxy(receiptInstance, appIds[1])
        tokenManager = TokenManager.at(tokenManagerAddress)
        votingAddress = getAppProxy(receiptInstance, appIds[3])
        voting = Voting.at(votingAddress)
        daoAddress = getEventResult(receiptInstance, 'DeployInstance', 'dao')
        vaultAddress = getEventResult(
          receiptInstance,
          'DeployInstance',
          'vault'
        )
        votingAddress = getEventResult(
          receiptInstance,
          'DeployInstance',
          'voting'
        )
        tokenAddress = getEventResult(
          receiptInstance,
          'DeployInstance',
          'token'
        )
        console.log('Dao Created', daoAddress)

        vaultAddress = getAppProxy(receiptInstance, appIds[2])
        vault = await Vault.at(vaultAddress)

        // Fundraising Apps
        marketMakerAddress = getAppProxy(receiptInstance, fundraisingAppIds[0])
        marketMaker = await BancorMarketMaker.at(addressBookAddress)
        controllerAddress = getAppProxy(receiptInstance, fundraisingAppIds[1])
        aragonFundraisingController = AragonFundraisingController.at(allocationsAddress)
        tapAddress = getAppProxy(receiptInstance, fundraisingAppIds[2])
        tap = await Tap.at(projectsAddress)
        poolAddress = getAppProxy(receiptInstance, fundraisingAppIds[3])
        pool = Pool.at(dotVotingAddress)
      })

      it('creates and initializes a DAO with its Token', async () => {
        assert.notEqual(tokenAddress, '0x0', 'Token not generated')
        assert.notEqual(tokenAddress, undefined, 'Token undefined')

        assert.notEqual(daoAddress, '0x0', 'Instance not generated')
        assert.notEqual(daoAddress, undefined, 'Instance undefined')

        // Check ENS assignment
        // const aragonIdNamehash = namehash(`${aragonId}.aragonid.eth`)
        // const resolvedAddr = await PublicResolver.at(
        //   await ens.resolver(aragonIdNamehash)
        // ).addr(aragonIdNamehash)
        // assert.equal(
        //   resolvedAddr,
        //   daoAddress,
        //   "aragonId ENS name doesn't match"
        // )

        // Check token values
        const token = MiniMeToken.at(tokenAddress)
        assert.equal(await token.name(), tokenName, "token name doesn't match")
        assert.equal(
          await token.symbol(),
          tokenSymbol,
          "token symbol doesn't match"
        )
      })

      it('has initialized all the installed apps', async () => {
        assert.isTrue(
          await tokenManager.hasInitialized(),
          'tokenManager not initialized'
        )
        assert.isTrue(await vault.hasInitialized(), 'vault not initialized')
        assert.isTrue(await voting.hasInitialized(), 'voting not initialized')

        // Fundraising Apps
        assert.isTrue(await pool.hasInitialized(), 'pool not initialized')
        assert.isTrue(await tap.hasInitialized(), 'tap not initialized')
        assert.isTrue(await marketMaker.hasInitialized(), 'Market Maker app not initialized')
        assert.isTrue(await aragonFundraisingController.hasInitialized(), 'Aragon Controller app not initialized')
      })

      it('has the correct permisssions', async () => {
        const dao = await getContract('Kernel').at(daoAddress)
        const acl = await getContract('ACL').at(await dao.acl())

        const checkRole = async (
          appAddress,
          permission,
          managerAddress,
          appName = '',
          roleName = '',
          granteeAddress = managerAddress
        ) => {
          assert.equal(
            await acl.getPermissionManager(appAddress, permission),
            managerAddress,
            `${appName} ${roleName} Manager should match`
          )
          assert.isTrue(
            await acl.hasPermission(granteeAddress, appAddress, permission),
            `Grantee should have ${appName} role ${roleName}`
          )
        }

        // App manager role
        await checkRole(
          daoAddress,
          await dao.APP_MANAGER_ROLE(),
          votingAddress,
          'Kernel',
          'APP_MANAGER'
        )

        // Create permissions role
        await checkRole(
          acl.address,
          await acl.CREATE_PERMISSIONS_ROLE(),
          votingAddress,
          'ACL',
          'CREATE_PERMISSION'
        )

        // EVMScript Registry
        const regConstants = await getContract(
          'EVMScriptRegistryConstants'
        ).new()
        const reg = await getContract('EVMScriptRegistry').at(
          await acl.getEVMScriptRegistry()
        )
        await checkRole(
          reg.address,
          await reg.REGISTRY_ADD_EXECUTOR_ROLE(),
          votingAddress,
          'EVMScriptRegistry',
          'ADD_EXECUTOR'
        )
        await checkRole(
          reg.address,
          await reg.REGISTRY_MANAGER_ROLE(),
          votingAddress,
          'EVMScriptRegistry',
          'REGISTRY_MANAGER'
        )

        // Token Manager
        await checkRole (
          tokenManager.address,
          await tokenManager.ISSUE_ROLE(),
          votingAddress,
          'TokenManager',
          'ISSUE_ROLE'
        )

        await checkRole (
          tokenManager.address,
          await tokenManager.ASSIGN_ROLE(),
          votingAddress,
          'TokenManager',
          'ASSIGN_ROLE'
        )

        await checkRole (
          tokenManager.address,
          await tokenManager.REVOKE_VESTINGS_ROLE(),
          votingAddress,
          'TokenManager',
          'REVOKE_VESTINGS_ROLE'
        )

        await checkRole (
          tokenManager.address,
          await tokenManager.BURN_ROLE(),
          marketMaker.address,
          'TokenManager',
          'BURN_ROLE'
        )

        await checkRole (
          tokenManager.address,
          await tokenManager.MINT_ROLE(),
          marketMaker.address,
          'TokenManager',
          'MINT_ROLE'
        )

        // Tap
        await checkRole (
          tap.address,
          await tap.UPDATE_RESERVE_ROLE(),
          votingAddress,
          'Tap',
          'UPDATE_RESERVE_ROLE'
        )

        await checkRole (
          tap.address,
          await tap.UPDATE_BENEFICIARY_ROLE(),
          votingAddress,
          'Tap',
          'UPDATE_BENEFICIARY_ROLE'
        )

        await checkRole (
          tap.address,
          await tap.UPDATE_MONTHLY_TAP_INCREASE_ROLE(),
          votingAddress,
          'Tap',
          'UPDATE_MONTHLY_TAP_INCREASE_ROLE'
        )

        await checkRole (
          tap.address,
          await tap.ADD_TOKEN_TAP_ROLE(),
          votingAddress,
          'Tap',
          'ADD_TOKEN_TAP_ROLE'
        )

        await checkRole (
          tap.address,
          await tap.REMOVE_TOKEN_TAP_ROLE(),
          votingAddress,
          'Tap',
          'REMOVE_TOKEN_TAP_ROLE'
        )

        await checkRole (
          tap.address,
          await tap.UPDATE_TOKEN_TAP_ROLE(),
          votingAddress,
          'Tap',
          'UPDATE_TOKEN_TAP_ROLE'
        )

        await checkRole (
          tap.address,
          await tap.WITHDRAW_ROLE(),
          ANY_ADDRESS,
          'Tap',
          'WITHDRAW_ROLE',
          votingAddress
        )

        // BancorMarketMaker
        await checkRole (
          marketMaker.address,
          await marketMaker.ADD_COLLATERAL_TOKEN_ROLE(),
          votingAddress,
          'BancorMarketMaker',
          'ADD_COLLATERAL_TOKEN_ROLE',
        )

        await checkRole (
          marketMaker.address,
          await marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(),
          votingAddress,
          'BancorMarketMaker',
          'UPDATE_COLLATERAL_TOKEN_ROLE',
        )

        await checkRole (
          marketMaker.address,
          await marketMaker.UPDATE_FEE_ROLE(),
          votingAddress,
          'BancorMarketMaker',
          'UPDATE_FEE_ROLE',
        )

        await checkRole (
          marketMaker.address,
          await marketMaker.UPDATE_GAS_COSTS_ROLE(),
          votingAddress,
          'BancorMarketMaker',
          'UPDATE_GAS_COSTS_ROLE',
        )

        await checkRole (
          marketMaker.address,
          await marketMaker.CREATE_BUY_ORDER_ROLE(),
          ANY_ADDRESS,
          'BancorMarketMaker',
          'CREATE_BUY_ORDER_ROLE',
          marketMaker.address
        )

        await checkRole (
          marketMaker.address,
          await marketMaker.CREATE_SELL_ORDER_ROLE(),
          ANY_ADDRESS,
          'BancorMarketMaker',
          'CREATE_SELL_ORDER_ROLE',
          marketMaker.address
        )

        // Pool
        await checkRole (
          pool.address,
          await pool.SAFE_EXECUTE_ROLE(),
          marketMaker.address,
          'Pool',
          'SAFE_EXECUTE_ROLE',
          votingAddress
        )

        await checkRole (
          pool.address,
          await pool.SAFE_EXECUTE_ROLE(),
          tap.address,
          'Pool',
          'SAFE_EXECUTE_ROLE',
          votingAddress
        )

        await checkRole (
          pool.address,
          await pool.ADD_COLLATERAL_TOKEN_ROLE(),
          votingAddress,
          'Pool',
          'ADD_COLLATERAL_TOKEN'
        )

        await checkRole (
          pool.address,
          await pool.REMOVE_COLLATERAL_TOKEN_ROLE(),
          votingAddress,
          'Pool',
          'REMOVE_COLLATERAL_TOKEN'
        )

        // Voting
        await checkRole (
          voting.address,
          await voting.CREATE_VOTES_ROLE(),
          ANY_ADDRESS,
          'Voting',
          'CREATE_VOTES_ROLE',
          votingAddress
        )

        await checkRole (
          voting.address,
          await voting.MODIFY_SUPPORT_ROLE(),
          votingAddress,
          'Voting',
          'MODIFY_SUPPORT_ROLE',
        )

        // Vault
        await checkRole (
          vault.address,
          await vault.TRANSFER_ROLE(),
          tap.address,
          'Vault',
          'TRANSFER_ROLE',
          vault.address
        )
      })

      it('cannot reinitialize apps', async () => {

        // Voting
        try {
          await voting.initialize(
            tokenAddress,
            neededSupport,
            minimumAcceptanceQuorum,
            votingTime
          )
        } catch (err) {
          assert.equal(err.receipt.status, 0, 'It should have thrown')
          return
        }
      })
    })
  }
})
