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

  context('#addCollateralToken', () => {
    context('sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      context('and token is ETH or ERC20', () => {
        context('and token does not already exist in mapping', () => {
          it('it should add collateral token in mapping', async () => {
            const token2 = await TokenMock.new(authorized, 10000)
            const token3 = await TokenMock.new(authorized, 10000)

            await pool.addCollateralToken(ETH, { from: authorized })
            await pool.addCollateralToken(token2.address, { from: authorized })
            await pool.addCollateralToken(token3.address, { from: authorized })

            const collateralTokensLength = await pool.collateralTokensLength()
            const address1 = await pool.collateralTokens(1)
            const address2 = await pool.collateralTokens(2)
            const address3 = await pool.collateralTokens(3)

            assert.equal(collateralTokensLength, 3)
            assert.equal(ETH, address1)
            assert.equal(token2.address, address2)
            assert.equal(token3.address, address3)
          })
        })
        context('but token already exists in mapping', () => {
          it('it should revert', async () => {
            const token = await TokenMock.new(authorized, 10000)
            await pool.addCollateralToken(token.address, { from: authorized })

            await assertRevert(
              async () =>
                await pool.addCollateralToken(token.address, {
                  from: authorized
                })
            )
          })
        })
      })
      context('but token is not ETH or ERC20', () => {
        it('it should revert', async () => {
          await assertRevert(
            async () =>
              await pool.addCollateralToken(root, { from: authorized })
          )
        })
      })
    })
    context('sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const token = await TokenMock.new(authorized, 10000)

        await assertRevert(
          async () =>
            await pool.addCollateralToken(token.address, { from: unauthorized })
        )
      })
    })
  })

  context('#removeCollateralToken', () => {
    context('sender has REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      context('and token already exists in mapping', () => {
        it('it should remove collateral token from mapping', async () => {
          const token2 = await TokenMock.new(authorized, 10000)
          const token3 = await TokenMock.new(authorized, 10000)

          await pool.addCollateralToken(ETH, { from: authorized })
          await pool.addCollateralToken(token2.address, { from: authorized })
          await pool.addCollateralToken(token3.address, { from: authorized })

          await pool.removeCollateralToken(token2.address, { from: authorized })

          const collateralTokensLength = await pool.collateralTokensLength()
          const address1 = await pool.collateralTokens(1)
          const address2 = await pool.collateralTokens(2)

          assert.equal(collateralTokensLength, 2)
          assert.equal(ETH, address1)
          assert.equal(token3.address, address2)
        })
      })
      context('but token does not already exist in mapping', () => {
        it('it should revert', async () => {
          const token1 = await TokenMock.new(authorized, 10000)
          const token2 = await TokenMock.new(authorized, 10000)
          await pool.addCollateralToken(token1.address, { from: authorized })

          await assertRevert(
            async () =>
              await pool.removeCollateralToken(token2.address, {
                from: authorized
              })
          )
        })
      })
    })

    context('sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const token = await TokenMock.new(authorized, 10000)
        await pool.addCollateralToken(token.address, { from: authorized })

        await assertRevert(
          async () =>
            await pool.removeCollateralToken(token.address, {
              from: unauthorized
            })
        )
      })
    })
  })
})
