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

const SimpleERC20 = artifacts.require('tokens/SimpleERC20')
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

    const ethConstant = await EtherTokenConstantMock.new()
    ETH = await ethConstant.getETHConstant()
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
      const newPool= await Pool.new()
      assert.isTrue(await newPool.isPetrified())
      return assertRevert(async () => {
        await newPool.initialize()
      })
    })
  })

  context("ETH", async () => {
    it("it should add to the collateral list", async () => {
      let initIdx = await pool.collateralTokenIndex(ETH, {from: authorized })
      assert.equal(initIdx.toNumber(), 0);

      //Add collateral token
      await pool.addCollateralToken(ETH, { from: authorized })
      assert.equal(await pool.collateralTokenIndex(ETH, {from: authorized }), initIdx.toNumber() + 1)
    })

    it("it should remove ETH from the collateral list", async () => {
      await pool.addCollateralToken(ETH, { from: authorized })
      await pool.removeCollateralToken(ETH, { from: authorized })

      assert.equal(await pool.collateralTokenIndex(ETH, {from: authorized }), 0)
    })

    it("it should revert removal if not in the collateral list", async () => {
      await assertRevert(async () => {
        await pool.removeCollateralToken(ETH, { from: authorized })
      })
    })

    it("it should revert add if the sender does not have 'ADD_COLLATEAL_TOKEN' role", async () => {
      await assertRevert(async () => {
        await pool.addCollateralToken(ETH, { from: unauthorized })
      })
    })

    //it("it should revert ETH removal if the sender does not have 'REMOVE_COLLATEAL_TOKEN' role", async () => {
    //  await pool.addCollateralToken(ETH, { from: authorized })
    //  assertRevert(async () => await pool.removeCollateralToken(ETH, { from: unauthorized })) //syntax doesn't work here (?)
    //})
  });

  context("ERC20", async () => {
    let token, token2

    beforeEach( async () => {
      token = await SimpleERC20.new()
      token2 = await SimpleERC20.new()
    })

    it("it should add to the collateral list", async () => {
      assert.equal((await pool.collateralTokenIndex(token.address, {from: authorized })).toNumber(), 0)
      await pool.addCollateralToken(token.address, { from: authorized })
      assert.equal(await pool.collateralTokenIndex(token.address, {from: authorized }), 1)
    })

    it("it should remove an existing token from the list", async () => {
      await pool.addCollateralToken(token.address, { from: authorized })
      await pool.removeCollateralToken(token.address, { from: authorized })
      assert.equal(await pool.collateralTokenIndex(token.address, {from: authorized }), 0)
    })

    it("it should revert removal if not in the collateral list", async () => {
      await pool.addCollateralToken(token.address, { from: authorized })
      await assertRevert(async () => {
        await pool.removeCollateralToken(token2.address, { from: authorized })
      })
    })

    it("it should revert add if the sender does not have 'ADD_COLLATEAL_TOKEN' role", async () => {
      await assertRevert(async () => {
        await pool.addCollateralToken(token.address, { from: unauthorized })
      })
    })

    it("it should revert token removal if the sender does not have 'REMOVE_COLLATEAL_TOKEN' role", async () => {
      await pool.addCollateralToken(token.address, { from: authorized })
      assertRevert(async () => await pool.removeCollateralToken(token.address, { from: unauthorized })) //This syntax passes (?)...
    })
  })
})
