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
const MiniMeToken = artifacts.require('MiniMeToken')
const TokenMock = artifacts.require('TokenMock')

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

const fundraisingApps = ['fundraising-market-maker-bancor', 'fundraising-controller-aragon-fundraising', 'fundraising-module-tap', 'fundraising-module-pool']
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
  let daoAddress, multisigTokenAddress, bondedTokenAddress

  let financeAddress, multisigTokenManagerAddress, vaultAddress, multisigAddress
  let finance, multisigTokenManager, vault, multisig

  let tokenManagerAddress, votingAddress, marketMakerAddress, controllerAddress, tapAddress, poolAddress
  let tokenManager, voting, marketMaker, controller, tap, pool

  let kit, receiptMultisig, receiptFundraising, collateral1, collateral2

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

  const INITIAL_TOKEN_BALANCE = 10000000

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

        collateral1 = await TokenMock.new(holder1, INITIAL_TOKEN_BALANCE * 2)
        collateral2 = await TokenMock.new(holder2, INITIAL_TOKEN_BALANCE * 2)

        if (creationStyle === 'single') {
          // create token and instance
          receiptInstance = await kit.newTokenAndInstance(tokenName, tokenSymbol, aragonId, holders)
          multisigTokenAddress = getEventResult(receiptInstance, 'DeployToken', 'token')
          daoAddress = getEventResult(receiptInstance, 'DeployInstance', 'dao')
        } else if (creationStyle === 'separate') {
          // create tokens
          const receiptToken = await kit.newTokens(tokenName, tokenSymbol)
          multisigTokenAddress = getEventResult(receiptToken, 'DeployToken', 'token1')
          bondedTokenAddress = getEventResult(receiptToken, 'DeployToken', 'token2')
          // create instance
          receiptMultisig = await kit.newMultisigInstance(aragonId, holders, 2, { from: owner })
          receiptFundraising = await kit.newFundraisingInstance(collateral1.address, collateral2.address, { from: owner })
        }

        // generated apps from dao creation
        financeAddress = getAppProxy(receiptMultisig, appIds[0])
        finance = await Finance.at(financeAddress)
        multisigTokenManagerAddress = getAppProxy(receiptMultisig, appIds[1])
        multisigTokenManager = TokenManager.at(multisigTokenManagerAddress)
        vaultAddress = getAppProxy(receiptMultisig, appIds[2])
        vault = Vault.at(vaultAddress)
        multisigAddress = getAppProxy(receiptMultisig, appIds[3])
        multisig = Voting.at(multisigAddress)
        daoAddress = getEventResult(receiptMultisig, 'DeployMultisigInstance', 'dao')
        multisigTokenAddress = getEventResult(receiptMultisig, 'DeployMultisigInstance', 'token')

        // Fundraising Apps
        tokenManagerAddress = getAppProxy(receiptFundraising, appIds[1])
        tokenManager = TokenManager.at(tokenManagerAddress)
        votingAddress = getAppProxy(receiptFundraising, appIds[3])
        voting = Voting.at(votingAddress)
        marketMakerAddress = getAppProxy(receiptFundraising, fundraisingAppIds[0])
        marketMaker = await BancorMarketMaker.at(marketMakerAddress)
        controllerAddress = getAppProxy(receiptFundraising, fundraisingAppIds[1])
        controller = AragonFundraisingController.at(controllerAddress)
        tapAddress = getAppProxy(receiptFundraising, fundraisingAppIds[2])
        tap = await Tap.at(tapAddress)
        poolAddress = getAppProxy(receiptFundraising, fundraisingAppIds[3])
        pool = Pool.at(poolAddress)
      })

      it('creates and initializes a DAO with its Token', async () => {
        assert.notEqual(multisigTokenAddress, '0x0', 'Token not generated')
        assert.notEqual(bondedTokenAddress, '0x0', 'Token not generated')
        assert.notEqual(daoAddress, '0x0', 'Instance not generated')

        // check ENS assignment
        const aragonIdNamehash = namehash(`${aragonId}.aragonid.eth`)
        const resolvedAddr = await PublicResolver.at(await ens.resolver(aragonIdNamehash)).addr(aragonIdNamehash)
        assert.equal(resolvedAddr, daoAddress, "aragonId ENS name doesn't match")

        // check token values
        const token = MiniMeToken.at(multisigTokenAddress)
        assert.equal(await token.name(), tokenName, "token name doesn't match")
        assert.equal(await token.symbol(), tokenSymbol, "token symbol doesn't match")
      })

      it('has initialized all the installed apps', async () => {
        assert.isTrue(await finance.hasInitialized(), 'finance not initialized')
        assert.isTrue(await multisigTokenManager.hasInitialized(), 'multisigTokenManager not initialized')
        assert.isTrue(await vault.hasInitialized(), 'vault not initialized')
        assert.isTrue(await multisig.hasInitialized(), 'multisig not initialized')

        assert.isTrue(await tokenManager.hasInitialized(), 'tokenManager not initialized')
        assert.isTrue(await voting.hasInitialized(), 'voting not initialized')
        assert.isTrue(await pool.hasInitialized(), 'pool not initialized')
        assert.isTrue(await tap.hasInitialized(), 'tap not initialized')
        assert.isTrue(await marketMaker.hasInitialized(), 'market maker not initialized')
        assert.isTrue(await controller.hasInitialized(), 'controller app not initialized')
      })

      it('has the correct permisssions', async () => {
        const dao = await getContract('Kernel').at(daoAddress)
        const acl = await getContract('ACL').at(await dao.acl())

        const checkRole = async (appAddress, permission, managerAddress, appName = '', roleName = '', granteeAddress = managerAddress) => {
          assert.equal(await acl.getPermissionManager(appAddress, permission), managerAddress, `${appName} ${roleName} Manager should match`)
          assert.isTrue(await acl.hasPermission(granteeAddress, appAddress, permission), `Grantee should have ${appName} role ${roleName}`)
        }

        // app manager role
        await checkRole(daoAddress, await dao.APP_MANAGER_ROLE(), votingAddress, 'Kernel', 'APP_MANAGER')

        // create permissions role
        await checkRole(acl.address, await acl.CREATE_PERMISSIONS_ROLE(), votingAddress, 'ACL', 'CREATE_PERMISSION')

        // evm script registry
        const regConstants = await getContract('EVMScriptRegistryConstants').new()
        const reg = await getContract('EVMScriptRegistry').at(await acl.getEVMScriptRegistry())
        await checkRole(reg.address, await reg.REGISTRY_ADD_EXECUTOR_ROLE(), multisigAddress, 'EVMScriptRegistry', 'ADD_EXECUTOR')
        await checkRole(reg.address, await reg.REGISTRY_MANAGER_ROLE(), multisigAddress, 'EVMScriptRegistry', 'REGISTRY_MANAGER')

        // multisig
        await checkRole(multisigAddress, await multisig.CREATE_VOTES_ROLE(), multisigAddress, 'Voting', 'CREATE_VOTES', multisigTokenManagerAddress)
        await checkRole(multisigAddress, await multisig.MODIFY_QUORUM_ROLE(), multisigAddress, 'Voting', 'MODIFY_QUORUM')
        await checkRole(multisigAddress, await multisig.MODIFY_SUPPORT_ROLE(), multisigAddress, 'Voting', 'MODIFY_SUPPORT')

        // vault
        await checkRole(vaultAddress, await vault.TRANSFER_ROLE(), multisigAddress, 'Vault', 'TRANSFER', financeAddress)

        // finance
        await checkRole(financeAddress, await finance.CREATE_PAYMENTS_ROLE(), multisigAddress, 'Finance', 'CREATE_PAYMENTS')
        await checkRole(financeAddress, await finance.EXECUTE_PAYMENTS_ROLE(), multisigAddress, 'Finance', 'EXECUTE_PAYMENTS')
        await checkRole(financeAddress, await finance.MANAGE_PAYMENTS_ROLE(), multisigAddress, 'Finance', 'MANAGE_PAYMENTS')

        // multisig token manager
        await checkRole(multisigTokenManagerAddress, await multisigTokenManager.ASSIGN_ROLE(), multisigAddress, 'TokenManager', 'ASSIGN')
        await checkRole(multisigTokenManagerAddress, await multisigTokenManager.REVOKE_VESTINGS_ROLE(), multisigAddress, 'TokenManager', 'REVOKE_VESTINGS')

        // token manager
        await checkRole(tokenManager.address, await tokenManager.MINT_ROLE(), votingAddress, 'TokenManager', 'MINT', marketMakerAddress)
        await checkRole(tokenManager.address, await tokenManager.BURN_ROLE(), votingAddress, 'TokenManager', 'BURN', marketMakerAddress)

        // voting
        await checkRole(votingAddress, await voting.CREATE_VOTES_ROLE(), votingAddress, 'Voting', 'CREATE_VOTES', tokenManagerAddress)
        await checkRole(votingAddress, await voting.MODIFY_QUORUM_ROLE(), votingAddress, 'Voting', 'MODIFY_QUORUM')
        assert.equal(
          await acl.getPermissionManager(votingAddress, await voting.MODIFY_SUPPORT_ROLE()),
          await acl.BURN_ENTITY(),
          'Voting MODIFY_SUPPORT Manager should be burned'
        )

        // pool
        await checkRole(poolAddress, await pool.SAFE_EXECUTE_ROLE(), votingAddress, 'Pool', 'SAFE_EXECUTE_ROLE')
        await checkRole(poolAddress, await pool.ADD_COLLATERAL_TOKEN_ROLE(), votingAddress, 'Pool', 'ADD_COLLATERAL_TOKEN', controllerAddress)
        await checkRole(poolAddress, await pool.TRANSFER_ROLE(), votingAddress, 'Pool', 'TRANSFER_ROLE', tapAddress)
        await checkRole(poolAddress, await pool.TRANSFER_ROLE(), votingAddress, 'Pool', 'TRANSFER_ROLE', marketMakerAddress)

        // tap
        await checkRole(tapAddress, await tap.UPDATE_BENEFICIARY_ROLE(), multisigAddress, 'Tap', 'UPDATE_BENEFICIARY_ROLE')
        await checkRole(tapAddress, await tap.UPDATE_MONTHLY_TAP_INCREASE_ROLE(), votingAddress, 'Tap', 'UPDATE_MONTHLY_TAP_INCREASE_ROLE', controllerAddress)
        await checkRole(tapAddress, await tap.ADD_TOKEN_TAP_ROLE(), votingAddress, 'Tap', 'ADD_TOKEN_TAP_ROLE', controllerAddress)
        await checkRole(tapAddress, await tap.UPDATE_TOKEN_TAP_ROLE(), votingAddress, 'Tap', 'UPDATE_TOKEN_TAP_ROLE', controllerAddress)
        await checkRole(tapAddress, await tap.WITHDRAW_ROLE(), multisigAddress, 'Tap', 'WITHDRAW_ROLE', controllerAddress)

        // controller
        await checkRole(controllerAddress, await controller.ADD_COLLATERAL_TOKEN_ROLE(), votingAddress, 'Controller', 'ADD_COLLATERAL_TOKEN_ROLE')
        await checkRole(controllerAddress, await controller.UPDATE_TOKEN_TAP_ROLE(), votingAddress, 'Controller', 'UPDATE_TOKEN_TAP_ROLE')
        await checkRole(controllerAddress, await controller.UPDATE_MONTHLY_TAP_INCREASE_ROLE(), votingAddress, 'Controller', 'UPDATE_MONTHLY_TAP_INCREASE_ROLE')
        await checkRole(controllerAddress, await controller.CREATE_BUY_ORDER_ROLE(), votingAddress, 'Controller', 'CREATE_BUY_ORDER_ROLE', ANY_ADDRESS)
        await checkRole(controllerAddress, await controller.CREATE_SELL_ORDER_ROLE(), votingAddress, 'Controller', 'CREATE_SELL_ORDER_ROLE', ANY_ADDRESS)
        await checkRole(controllerAddress, await controller.WITHDRAW_ROLE(), multisigAddress, 'Controller', 'WITHDRAW_ROLE')

        // market maker
        await checkRole(
          marketMakerAddress,
          await marketMaker.ADD_COLLATERAL_TOKEN_ROLE(),
          votingAddress,
          'Controller',
          'ADD_COLLATERAL_TOKEN_ROLE',
          controllerAddress
        )
        await checkRole(
          marketMakerAddress,
          await marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(),
          votingAddress,
          'Controller',
          'UPDATE_COLLATERAL_TOKEN_ROLE',
          controllerAddress
        )
        await checkRole(marketMakerAddress, await marketMaker.UPDATE_FEES_ROLE(), votingAddress, 'Controller', 'UPDATE_FEES_ROLE', controllerAddress)

        await checkRole(marketMakerAddress, await marketMaker.CREATE_BUY_ORDER_ROLE(), votingAddress, 'Controller', 'CREATE_BUY_ORDER_ROLE', controllerAddress)
        await checkRole(
          marketMakerAddress,
          await marketMaker.CREATE_SELL_ORDER_ROLE(),
          votingAddress,
          'Controller',
          'CREATE_SELL_ORDER_ROLE',
          controllerAddress
        )

        // await checkRole(marketMakerAddress, await marketMaker.UPDATE_FEES_ROLE(), votingAddress, 'Controller', 'UPDATE_FEES_ROLE', controllerAddress)
        // await checkRole(marketMakerAddress, await marketMaker.CREATE_BUY_ORDER_ROLE(), votingAddress, 'Controller', 'CREATE_BUY_ORDER_ROLE', ANY_ADDRESS)
        // await checkRole(marketMakerAddress, await marketMaker.CREATE_SELL_ORDER_ROLE(), votingAddress, 'Controller', 'CREATE_SELL_ORDER_ROLE', ANY_ADDRESS)

        // await checkRole(marketMaker.address, await marketMaker.ADD_COLLATERAL_TOKEN_ROLE(), votingAddress, 'BancorMarketMaker', 'ADD_COLLATERAL_TOKEN_ROLE')
        // await checkRole(
        //   marketMaker.address,
        //   await marketMaker.UPDATE_COLLATERAL_TOKEN_ROLE(),
        //   votingAddress,
        //   'BancorMarketMaker',
        //   'UPDATE_COLLATERAL_TOKEN_ROLE'
        // )

        // await checkRole(marketMaker.address, await marketMaker.UPDATE_FEE_ROLE(), votingAddress, 'BancorMarketMaker', 'UPDATE_FEE_ROLE')
        // await checkRole(marketMaker.address, await marketMaker.UPDATE_GAS_COSTS_ROLE(), votingAddress, 'BancorMarketMaker', 'UPDATE_GAS_COSTS_ROLE')
        // await checkRole(
        //   marketMaker.address,
        //   await marketMaker.CREATE_BUY_ORDER_ROLE(),
        //   ANY_ADDRESS,
        //   'BancorMarketMaker',
        //   'CREATE_BUY_ORDER_ROLE',
        //   marketMaker.address
        // )
        // await checkRole(
        //   marketMaker.address,
        //   await marketMaker.CREATE_SELL_ORDER_ROLE(),
        //   ANY_ADDRESS,
        //   'BancorMarketMaker',
        //   'CREATE_SELL_ORDER_ROLE',
        //   marketMaker.address
        // )

        // // Vault
        // await checkRole(vault.address, await vault.TRANSFER_ROLE(), tap.address, 'Vault', 'TRANSFER_ROLE', vault.address)
      })
    })
  }
})
