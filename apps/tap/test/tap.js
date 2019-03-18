const Agent = artifacts.require('Agent')

const {
  assertRevert,
  assertInvalidOpcode
} = require('@aragon/test-helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const ethUtil = require('ethereumjs-util')
const getBalance = require('@aragon/test-helpers/balance')(web3)
const web3Call = require('@aragon/test-helpers/call')(web3)
const web3Sign = require('@aragon/test-helpers/sign')(web3)

const assertEvent = require('@aragon/test-helpers/assertEvent')
const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event == event)[0].args[arg]
}

const ACL = artifacts.require('ACL')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const Kernel = artifacts.require('Kernel')
const KernelProxy = artifacts.require('KernelProxy')
const Pool = artifacts.require('Pool')
const Vault = artifacts.require('Vault')
const Tap = artifacts.require('Tap')
const TokenMock = artifacts.require('TokenMock')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const DestinationMock = artifacts.require('DestinationMock')
const KernelDepositableMock = artifacts.require('KernelDepositableMock')
const ForceSendETH = artifacts.require('ForceSendETH')

const NULL_ADDRESS = '0x00'

contract('Tap app', accounts => {
  let daoFact, agentBase, agent, agentAppId, tapBase, tap, poolBase, pool, token1, token2 = {}

  let ETH,
    ANY_ENTITY,
    APP_MANAGER_ROLE,
    EXECUTE_ROLE,
    RUN_SCRIPT_ROLE,
    ADD_PRESIGNED_HASH_ROLE,
    DESIGNATE_SIGNER_ROLE,
    ERC1271_INTERFACE_ID,
    ADD_TOKEN_TAP_ROLE,
    REMOVE_TOKEN_TAP_ROLE,
    UPDATE_TOKEN_TAP_ROLE,
    UPDATE_POOL_ROLE,
    UPDATE_VAULT_ROLE,
    WITHDRAW_ROLE,
    TRANSFER_ROLE

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  const n = '0x00'
  const START_TIME = 1
  const PERIOD_DURATION = 60 * 60 * 24 // One day in seconds
  const withdrawAddr = ' 0x0000000000000000000000000000000000001234'
  const INITIAL_ETH_BALANCE = 400
  const INITIAL_TAP_RATE = 50
  const tapAmt = 20

  before(async () => {
    const kernelBase = await Kernel.new(true) // petrify immediately
    const aclBase = await ACL.new()
    const regFact = await EVMScriptRegistryFactory.new()
    daoFact = await DAOFactory.new(
      kernelBase.address,
      aclBase.address,
      regFact.address
    )
    agentBase = await Agent.new()
    tapBase = await Tap.new()
    poolBase = await Pool.new()
    vaultBase = await Vault.new()

    // Setup constants
    ANY_ENTITY = await aclBase.ANY_ENTITY()
    APP_MANAGER_ROLE = await kernelBase.APP_MANAGER_ROLE()
    EXECUTE_ROLE = await agentBase.EXECUTE_ROLE()
    RUN_SCRIPT_ROLE = await agentBase.RUN_SCRIPT_ROLE()
    ADD_PRESIGNED_HASH_ROLE = await agentBase.ADD_PRESIGNED_HASH_ROLE()
    DESIGNATE_SIGNER_ROLE = await agentBase.DESIGNATE_SIGNER_ROLE()
    ERC1271_INTERFACE_ID = await agentBase.ERC1271_INTERFACE_ID()
    ADD_TOKEN_TAP_ROLE = await tapBase.ADD_TOKEN_TAP_ROLE()
    REMOVE_TOKEN_TAP_ROLE = await tapBase.REMOVE_TOKEN_TAP_ROLE()
    UPDATE_TOKEN_TAP_ROLE = await tapBase.UPDATE_TOKEN_TAP_ROLE()
    UPDATE_POOL_ROLE = await tapBase.UPDATE_POOL_ROLE()
    UPDATE_VAULT_ROLE = await tapBase.UPDATE_VAULT_ROLE()
    WITHDRAW_ROLE = await tapBase.WITHDRAW_ROLE()
    TRANSFER_ROLE = await vaultBase.TRANSFER_ROLE()

    const ethConstant = await EtherTokenConstantMock.new()
    ETH = await ethConstant.getETHConstant()
  })

  const setupAgentDispatch = async (dao) => {
    const agentId = hash('agent.aragonpm.eth')
    const agentReceipt = await dao.newAppInstance(agentId, agentBase.address, '0x', false, { from: root })
    const agentDispatch = await Agent.at(agentReceipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    await agentDispatch.initialize()
    await dao.setApp(await dao.APP_ADDR_NAMESPACE(), agentId, agentDispatch.address)

    return agentDispatch
  }

  const setupInitialPool = async (dao) => {
    const poolId = hash('fundraising-pool.aragonpm.eth')
    const poolReceipt = await dao.newAppInstance(poolId, poolBase.address, '0x', false, { from: root })
    const initialPool = await Pool.at(poolReceipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    await initialPool.initialize()
    await dao.setApp(await dao.APP_ADDR_NAMESPACE(), poolId, initialPool.address)

    return initialPool
  }

  const setupRecoveryVault = async (dao) => {
    const vaultId = hash('vault.aragonpm.eth')
    const vaultReceipt = await dao.newAppInstance(vaultId, vaultBase.address, '0x', false, { from: root })
    const recoveryVault = await Vault.at(vaultReceipt.logs.filter(l => l.event == 'NewAppProxy')[0].args.proxy)
    await recoveryVault.initialize()
    await dao.setApp(await dao.APP_ADDR_NAMESPACE(), vaultId, recoveryVault.address)
    await dao.setRecoveryVaultAppId(vaultId, { from: root })

    return recoveryVault
  }

  const newProxyTap = async () => {
    const r = await daoFact.newDAO(root)
    const dao = await Kernel.at(getEvent(r, 'DeployDAO', 'dao'))
    const acl = await ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, {
      from: root
    })

    // tap
    const tapAppId = hash('fundraising-tap.aragonpm.test')
    const tapReceipt = await dao.newAppInstance(tapAppId, tapBase.address, '0x', false, { from: root })
    const tapApp = await Tap.at(getEvent(tapReceipt, 'NewAppProxy', 'proxy'))

    await acl.createPermission(authorized, tapApp.address, ADD_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, tapApp.address, REMOVE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, tapApp.address, UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, tapApp.address, UPDATE_POOL_ROLE, root, { from: root })
    await acl.createPermission(authorized, tapApp.address, UPDATE_VAULT_ROLE, root, { from: root })
    await acl.createPermission(authorized, tapApp.address, WITHDRAW_ROLE, root, { from: root })

    const recoveryVault = await setupRecoveryVault(dao)
    const initialPool = await setupInitialPool(dao)
    const agentDispatch = await setupAgentDispatch(dao)

    return { dao, tapApp, recoveryVault, initialPool, agentDispatch }
  }
  const forceSendETH = async (to, value) => {
    // Using this contract ETH will be send by selfdestruct which always succeeds
    const forceSend = await ForceSendETH.new()
    return forceSend.sendByDying(to, { value })
  }

  beforeEach(async () => {
    const { dao, tapApp, recoveryVault, initialPool, agentDispatch } = await newProxyTap()
    tap = tapApp
    pool = initialPool
    agent = agentDispatch

    //vault
    const receipt1 = await dao.newAppInstance('0x1234', vaultBase.address, '0x', false, { from: root })
    vault = await Vault.at(getEvent(receipt1, 'NewAppProxy', 'proxy'))
    const acl = await ACL.at(await dao.acl())
    await acl.createPermission(tap.address, vault.address, TRANSFER_ROLE, root, { from: root })
    await vault.initialize()
    await forceSendETH(pool.address, INITIAL_ETH_BALANCE)
    token1 = await TokenMock.new(pool.address, 10000)

    await tap.initialize(pool.address, vault.address, INITIAL_TAP_RATE)
  })

  context("> initialize", () => {
    it("it should revert on re-initialization", async () => {
      const newTap = await Tap.new()
      const newVault = await Vault.new()
      const newPool = await Pool.new()
      assert.isTrue(await newTap.isPetrified())
      assert.isTrue(await newVault.isPetrified())
      assert.isTrue(await newPool.isPetrified())
      return assertRevert(async () => {
        await newTap.initialize(newPool, newVault, 15)
      })
    })
  })

  context("> withdraw", () => {
    context("ETH", () => {
      it("it should transfer a tap-defined amount of ETH from the collateral pool to the vault", async () => {
        await tap.addTokenTap(ETH, tapAmt, { from: authorized })
        assert.equal(await getBalance(pool.address), INITIAL_ETH_BALANCE, 'pool balance should be correct prior to withdraw')
        await tap.withdraw(ETH, { from: authorized })

        let balance = await tap.poolBalance(ETH, { from: authorized })
        assert.equal(balance.toNumber(), INITIAL_ETH_BALANCE - tapAmt, 'pool balance should be decreased by tap amount')
        assert.equal(await getBalance(vault.address), tapAmt, 'vault balance should be equal to tap amount')
      })
    })

    context("ERC20", () => {
      it("it should transfer a tap-defined amount of ERC20 from the collateral pool to the vault", async () => {
        await tap.addTokenTap(token1.address, tapAmt, { from: authorized })
        assert.equal(await token1.balanceOf(pool.address), 10000, 'pool should have ERC20 token balance')
        await tap.withdraw(token1.address, { from: authorized })

        assert.equal(await token1.balanceOf(pool.address), 10000 - tapAmt, 'token balance in pool should decrease by tap amount')
        assert.equal(await token1.balanceOf(vault.address), tapAmt, 'vault should have updated token balance')
      })
    })

    it("it should revert if sender does not have 'WITHDRAW_ROLE'", async () => {
      return assertRevert(async () => {
        await tap.withdraw(token1.address, { from: unauthorized })
      })
    })
  })

  context("> addTokenTap", () => {
    context('sender has ADD_TOKEN_TAP_ROLE', () => {
      context('and token is ETH or ERC20', () => {
        context('and token does not already exist in mapping', () => {
          it('it should add tap token in mapping', async () => {
            token2 = await TokenMock.new(authorized, 10000)
            const token3 = await TokenMock.new(authorized, 10000)

            await tap.addTokenTap(ETH, tapAmt, { from: authorized })
            await tap.addTokenTap(token2.address, tapAmt, { from: authorized })
            await tap.addTokenTap(token3.address, tapAmt, { from: authorized })
            assert(await tap.getWithdrawalValue(ETH))
            assert(await tap.getWithdrawalValue(token2.address))
            assert(await tap.getWithdrawalValue(token3.address))
          })
        })
        context('but token already exists in mapping', () => {
          it('it should revert', async () => {
            await tap.addTokenTap(token2.address, tapAmt, { from: authorized })

            await assertRevert(
              async () =>
                await tap.addTokenTap(token2.address, tapAmt, {
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
              await tap.addTokenTap(root, tapAmt, { from: authorized })
          )
        })
      })
    })
    context('sender does not have ADD_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        const token = await TokenMock.new(authorized, 10000)

        await assertRevert(
          async () =>
            await tap.addTokenTap(token.address, tapAmt, { from: unauthorized })
        )
      })
    })
  })

  context("> removeTokenTap", () => {
    context('sender has REMOVE_TOKEN_TAP_ROLE', () => {
      context('and token is ETH or ERC20', () => {
        context('and token does exist in mapping', () => {
          it('it should remove tap token in mapping', async () => {
            token2 = await TokenMock.new(authorized, 10000)

            await tap.addTokenTap(ETH, tapAmt, { from: authorized })
            await tap.addTokenTap(token2.address, tapAmt, { from: authorized })

            await tap.removeTokenTap(ETH, { from: authorized })
            const receipt = await tap.removeTokenTap(token2.address, { from: authorized })
            assertEvent(receipt, 'RemoveTokenTap')
          })
        })
        context('but token does not exist in mapping', () => {
          it('it should revert', async () => {
            const token = await TokenMock.new(authorized, 10000)
            await assertRevert(
              async () =>
                await tap.removeTokenTap(token.address, {
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
              await tap.removeTokenTap(root, { from: authorized })
          )
        })
      })
    })
    context('sender does not have REMOVE_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        const token = await TokenMock.new(authorized, 10000)
        await tap.addTokenTap(token.address, tapAmt, { from: authorized })

        await assertRevert(
          async () =>
            await tap.removeTokenTap(token.address, { from: unauthorized })
        )
      })
    })
  })

  context("updateTokenTap", () => {
    context("sender does have UPDATE_TOKEN_TAP_ROLE", () => {
      context('and token is ETH or ERC20', () => {
        it("it should update tap rate if within monthly limit", async () => {
          const token = await TokenMock.new(authorized, 10000)
          await tap.addTokenTap(ETH, tapAmt, { from: authorized })
          await tap.addTokenTap(token.address, tapAmt, { from: authorized })

          await tap.updateTokenTap(ETH, 10, { from: authorized })
          await tap.updateTokenTap(token.address, 10, { from: authorized })
         // assertEvent(receipt, 'UpdateTokenTap')

        })
        it("it should revert if tap rate exceeds limit within 30 days", async () => {
          //I'd like to submit a transaction with a spoofed date?
          const token = await TokenMock.new(authorized, 10000)
          await tap.addTokenTap(ETH, tapAmt, { from: authorized })
          await tap.addTokenTap(token.address, tapAmt, { from: authorized })

          /* await assertRevert(
            async () =>
              await tap.updateTokenTap(token.address, 100, { from: authorized })
          ) */
        })
        it("it should revert if not in tap list", async () => {
          const token = await TokenMock.new(authorized, 10000)
          await assertRevert(
            async () =>
              await tap.updateTokenTap(token.address, 30, { from: authorized })
          )
        })
      })
    })
  })

  context("updateVault", () => {
    context("sender does have UPDATE_VAULT_ROLE", () => {
      it("it should update vault address", async () => {
        const vault2 = await Vault.new()
        const receipt = await tap.updateVault(vault2.address, { from: authorized })
        assertEvent(receipt, 'UpdateVault')
        //How do I access contract data and assert the vault address has been updated?
      })
      it("it should revert if not vault contract", async () => {
        await assertRevert(
          async () =>
            await tap.updateVault(root, { from: authorized })
        )
      })
    })
    context("sender does not have UPDATE_VAULT_ROLE", () => {
      it("it should revert", async () => {
        const vault2 = await Vault.new()
        await assertRevert(
          async () =>
            await tap.updateVault(vault2.address, { from: unauthorized })
        )
      })
    })
  })

  context("updateCollateralPool", () => {
    context("sender does have UPDATE_POOL_ROLE", () => {
      it("it should update pool address", async () => {
        const pool2 = await Pool.new()
        const receipt = await tap.updatePool(pool2.address, { from: authorized })
        assertEvent(receipt, 'UpdatePool')
        //Need to test once accessed contract data and assert the vault address has been updated
      })
      it("it should revert if not pool contract", async () => {
        await assertRevert(
          async () =>
            await tap.updatePool(root, { from: authorized })
        )
      })
    })
    context("sender does not have UPDATE_POOL_ROLE", () => {
      it("it should revert", async () => {
        const pool2 = await Pool.new()
        await assertRevert(
          async () =>
            await tap.updatePool(pool2, { from: unauthorized })
        )
      })
    })
  })
})
