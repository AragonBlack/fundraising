const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const getBalanceFn = require('@aragon/test-helpers/balance')
const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event == event)[0].args[arg]
}

const ACL = artifacts.require('ACL')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const Kernel = artifacts.require('Kernel')
const Pool = artifacts.require('Pool')

const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')

contract('Pool app', accounts => {
  let factory, pBase, pool, poolId
  let ETH,
    ANY_ENTITY,
    APP_MANAGER_ROLE,
    SAFE_EXECUTE_ROLE,
    ADD_COLLATERAL_TOKEN_ROLE,
    REMOVE_COLLATERAL_TOKEN_ROLE

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  before(async () => {
    // factory
    const kBase = await Kernel.new(true) // petrify immediately
    const aBase = await ACL.new()
    const rFact = await EVMScriptRegistryFactory.new()
    pBase = await Pool.new()
    factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)

    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    ANY_ENTITY = await aBase.ANY_ENTITY()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    SAFE_EXECUTE_ROLE = await pBase.SAFE_EXECUTE_ROLE()
    ADD_COLLATERAL_TOKEN_ROLE = await pBase.ADD_COLLATERAL_TOKEN_ROLE()
    REMOVE_COLLATERAL_TOKEN_ROLE = await pBase.REMOVE_COLLATERAL_TOKEN_ROLE()
  })

  beforeEach(async () => {
    // dao
    const dReceipt = await factory.newDAO(root)
    const dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    const acl = ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, {
      from: root
    })

    // pool
    poolId = hash('fundraising-pool.aragonpm.eth')
    const pReceipt = await dao.newAppInstance(
      poolId,
      pBase.address,
      '0x',
      false
    )
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))

    await acl.createPermission(
      authorized,
      pool.address,
      SAFE_EXECUTE_ROLE,
      root,
      {
        from: root
      }
    )
    await acl.createPermission(
      authorized,
      pool.address,
      ADD_COLLATERAL_TOKEN_ROLE,
      root,
      {
        from: root
      }
    )
    await acl.createPermission(
      authorized,
      pool.address,
      REMOVE_COLLATERAL_TOKEN_ROLE,
      root,
      {
        from: root
      }
    )

    await pool.initialize()
  })

  context('#initialize', () => {
    it('it should revert on re-initialization', async () => {
      await assertRevert(() => pool.initialize())
    })
  })
})
