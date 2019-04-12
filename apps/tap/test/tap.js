/* eslint-disable no-undef */
const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const getBalance = require('@aragon/test-helpers/balance')(web3)
const assertEvent = require('@aragon/test-helpers/assertEvent')
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { hash } = require('eth-ens-namehash')

const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event === event)[0].args[arg]
}
const getTimestamp = receipt => {
  return web3.eth.getBlock(receipt.receipt.blockNumber).timestamp
}

const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const Vault = artifacts.require('Vault')
const Pool = artifacts.require('Pool')
const Tap = artifacts.require('Tap')
const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')
const ForceSendETH = artifacts.require('ForceSendETH')

contract('Tap app', accounts => {
  let factory, dao, acl, tBase, tap, pBase, pool, vBase, vault, token1, token2
  let ETH, APP_MANAGER_ROLE, UPDATE_VAULT_ROLE, UPDATE_POOL_ROLE, ADD_TOKEN_TAP_ROLE, REMOVE_TOKEN_TAP_ROLE, UPDATE_TOKEN_TAP_ROLE, WITHDRAW_ROLE, TRANSFER_ROLE

  const VAULT_ID = hash('vault.aragonpm.eth')
  const POOL_ID = hash('pool.aragonpm.eth')
  const TAP_ID = hash('tap.aragonpm.eth')

  const INITIAL_ETH_BALANCE = 400
  const INITIAL_TOKEN_BALANCE = 1000
  const MAX_MONTHLY_TAP_INCREASE_RATE = 50 * Math.pow(10, 16)

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  const initialize = async _ => {
    // DAO
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
    // vault
    const vReceipt = await dao.newAppInstance(VAULT_ID, vBase.address, '0x', false)
    vault = await Vault.at(getEvent(vReceipt, 'NewAppProxy', 'proxy'))
    // pool
    const pReceipt = await dao.newAppInstance(POOL_ID, pBase.address, '0x', false)
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))
    // tap
    const tReceipt = await dao.newAppInstance(TAP_ID, tBase.address, '0x', false)
    tap = await Tap.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(authorized, tap.address, UPDATE_VAULT_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_POOL_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, ADD_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, REMOVE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_TOKEN_TAP_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, WITHDRAW_ROLE, root, { from: root })
    await acl.createPermission(tap.address, pool.address, TRANSFER_ROLE, root, { from: root })
    // initializations
    await vault.initialize()
    await pool.initialize()
    await tap.initialize(vault.address, pool.address, MAX_MONTHLY_TAP_INCREASE_RATE)
    // balances
    await forceSendETH(pool.address, INITIAL_ETH_BALANCE)
    token1 = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)
    token2 = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)
  }

  const forceSendETH = async (to, value) => {
    // Using this contract ETH will be send by selfdestruct which always succeeds
    const forceSend = await ForceSendETH.new()
    return forceSend.sendByDying(to, { value })
  }

  before(async () => {
    // factory
    const kBase = await Kernel.new(true) // petrify immediately
    const aBase = await ACL.new()
    const rFact = await EVMScriptRegistryFactory.new()
    factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)
    // base contracts
    tBase = await Tap.new()
    pBase = await Pool.new()
    vBase = await Vault.new()
    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    ADD_TOKEN_TAP_ROLE = await tBase.ADD_TOKEN_TAP_ROLE()
    REMOVE_TOKEN_TAP_ROLE = await tBase.REMOVE_TOKEN_TAP_ROLE()
    UPDATE_TOKEN_TAP_ROLE = await tBase.UPDATE_TOKEN_TAP_ROLE()
    UPDATE_POOL_ROLE = await tBase.UPDATE_POOL_ROLE()
    UPDATE_VAULT_ROLE = await tBase.UPDATE_VAULT_ROLE()
    WITHDRAW_ROLE = await tBase.WITHDRAW_ROLE()
    TRANSFER_ROLE = await pBase.TRANSFER_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  context('> #initialize', () => {
    context('> initialize parameters are correct', () => {
      it('it should initialize tap contract', async () => {
        assert.equal(await tap.vault(), vault.address)
        assert.equal(await tap.pool(), pool.address)
        assert.equal(await tap.maxMonthlyTapIncreaseRate(), MAX_MONTHLY_TAP_INCREASE_RATE)
      })
    })

    context('> initialize parameters are not correct', () => {
      it('it should revert', async () => {
        const dReceipt = await factory.newDAO(root)
        const dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
        const acl = ACL.at(await dao.acl())
        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

        const tReceipt = await dao.newAppInstance(TAP_ID, tBase.address, '0x', false)
        const _tap = await Tap.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))

        await assertRevert(async () => _tap.initialize(root, pool.address, MAX_MONTHLY_TAP_INCREASE_RATE))
        await assertRevert(async () => _tap.initialize(vault.address, root, MAX_MONTHLY_TAP_INCREASE_RATE))
      })
    })

    it('it should revert on re-initialization', async () => {
      return assertRevert(async () => {
        await tap.initialize(pool.address, vault.address, MAX_MONTHLY_TAP_INCREASE_RATE, { from: authorized })
      })
    })
  })

  context('> #updateVault', () => {
    context('> sender has UPDATE_VAULT_ROLE', () => {
      context('> and new vault is a contract', () => {
        it('it should update vault', async () => {
          const vault2 = await Vault.new()
          const receipt = await tap.updateVault(vault2.address, { from: authorized })

          assertEvent(receipt, 'UpdateVault')
          assert.equal(await tap.vault(), vault2.address)
        })
      })

      context('> but new vault is not a contract', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.updateVault(root, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_VAULT_ROLE', () => {
      it('it should revert', async () => {
        const vault2 = await Vault.new()
        await assertRevert(() => tap.updateVault(vault2.address, { from: unauthorized }))
      })
    })
  })

  context('> #updatePool', () => {
    context('> sender has UPDATE_POOL_ROLE', () => {
      context('> and new pool is a contract', () => {
        it('it should update pool', async () => {
          const pool2 = await Pool.new()
          const receipt = await tap.updatePool(pool2.address, { from: authorized })

          assertEvent(receipt, 'UpdatePool')
          assert.equal(await tap.pool(), pool2.address)
        })
      })

      context('> but new pool is not a contract', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.updatePool(root, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_POOL_ROLE', () => {
      it('it should revert', async () => {
        const pool2 = await Pool.new()
        await assertRevert(() => tap.updatePool(pool2.address, { from: unauthorized }))
      })
    })
  })

  context('> #addTokenTap', () => {
    context('> sender has ADD_TOKEN_TAP_ROLE', () => {
      context('> and token is ETH or ERC20', () => {
        context('> and token does not already exist', () => {
          context('> and tap is above zero', () => {
            it('it should add tap token', async () => {
              const receipt1 = await tap.addTokenTap(ETH, 10, { from: authorized })
              const receipt2 = await tap.addTokenTap(token1.address, 50, { from: authorized })
              const receipt3 = await tap.addTokenTap(token2.address, 100, { from: authorized })

              const timestamp1 = getTimestamp(receipt1)
              const timestamp2 = getTimestamp(receipt2)
              const timestamp3 = getTimestamp(receipt3)

              assertEvent(receipt1, 'AddTokenTap')
              assertEvent(receipt2, 'AddTokenTap')
              assertEvent(receipt3, 'AddTokenTap')

              assert.equal(await tap.taps(ETH), 10)
              assert.equal(await tap.taps(token1.address), 50)
              assert.equal(await tap.taps(token2.address), 100)

              assert.equal(await tap.lastWithdrawals(ETH), timestamp1)
              assert.equal(await tap.lastWithdrawals(token1.address), timestamp2)
              assert.equal(await tap.lastWithdrawals(token2.address), timestamp3)

              assert.equal(await tap.lastTapUpdates(ETH), timestamp1)
              assert.equal(await tap.lastTapUpdates(token1.address), timestamp2)
              assert.equal(await tap.lastTapUpdates(token2.address), timestamp3)
            })
          })

          context('> but tap is zero', () => {
            it('it should revert', async () => {
              await assertRevert(() => tap.addTokenTap(ETH, 0, { from: authorized }))
              await assertRevert(() => tap.addTokenTap(token1.address, 0, { from: authorized }))
            })
          })
        })

        context('> but token already exists', () => {
          it('it should revert', async () => {
            await tap.addTokenTap(token1.address, 50, { from: authorized })

            await assertRevert(() => tap.addTokenTap(token1.address, 50, { from: authorized }))
          })
        })
      })

      context('> but token is not ETH or ERC20', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.addTokenTap(root, 50, { from: authorized }))
        })
      })
    })

    context('> sender does not have ADD_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => tap.addTokenTap(token1.address, 50, { from: unauthorized }))
      })
    })
  })

  context('> #removeTokenTap', () => {
    context('> sender has REMOVE_TOKEN_TAP_ROLE', () => {
      context('> and token exists', () => {
        it('it should remove token tap', async () => {
          await tap.addTokenTap(ETH, 2, { from: authorized })
          await tap.addTokenTap(token1.address, 5, { from: authorized })

          const receipt1 = await tap.removeTokenTap(ETH, { from: authorized })
          const receipt2 = await tap.removeTokenTap(token1.address, { from: authorized })

          assertEvent(receipt1, 'RemoveTokenTap')
          assertEvent(receipt2, 'RemoveTokenTap')
          assert.equal(await tap.taps(ETH), 0)
          assert.equal(await tap.taps(token1.address), 0)
        })
      })

      context('> but token does not exist', () => {
        it('it should revert', async () => {
          const token = await TokenMock.new(authorized, 10000)

          await assertRevert(async () => tap.removeTokenTap(token.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have REMOVE_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTokenTap(token1.address, 2, { from: authorized })

        await assertRevert(() => tap.removeTokenTap(token1.address, { from: unauthorized }))
      })
    })
  })

  context('> #updateTokenTap', () => {
    context('> sender has UPDATE_TOKEN_TAP_ROLE', () => {
      context('> and token exists', () => {
        context('> and new tap rate is above zero', () => {
          context('> and increase is within monthly limit', () => {
            it('it should update tap rate', async () => {
              await tap.addTokenTap(ETH, 10, { from: authorized })
              await tap.addTokenTap(token1.address, 20, { from: authorized })
              await tap.addTokenTap(token2.address, 30, { from: authorized })
              // 1 month = 2592000 seconds
              await timeTravel(2592000)

              const receipt1 = await tap.updateTokenTap(ETH, 14, { from: authorized })
              const receipt2 = await tap.updateTokenTap(token1.address, 15, { from: authorized })
              const receipt3 = await tap.updateTokenTap(token2.address, 44, { from: authorized })

              assertEvent(receipt1, 'UpdateTokenTap')
              assertEvent(receipt2, 'UpdateTokenTap')
              assertEvent(receipt3, 'UpdateTokenTap')

              assert.equal(await tap.taps(ETH), 14)
              assert.equal(await tap.taps(token1.address), 15)
              assert.equal(await tap.taps(token2.address), 44)

              assert.equal(await tap.lastTapUpdates(ETH), getTimestamp(receipt1))
              assert.equal(await tap.lastTapUpdates(token1.address), getTimestamp(receipt2))
              assert.equal(await tap.lastTapUpdates(token2.address), getTimestamp(receipt3))

              // let's time travel and update again
              // 2 weeks = 1296000 seconds
              await timeTravel(2592000)

              const receipt4 = await tap.updateTokenTap(ETH, 17, { from: authorized })
              const receipt5 = await tap.updateTokenTap(token1.address, 18, { from: authorized })
              const receipt6 = await tap.updateTokenTap(token2.address, 10, { from: authorized })

              assertEvent(receipt4, 'UpdateTokenTap')
              assertEvent(receipt5, 'UpdateTokenTap')
              assertEvent(receipt6, 'UpdateTokenTap')

              assert.equal(await tap.taps(ETH), 17)
              assert.equal(await tap.taps(token1.address), 18)
              assert.equal(await tap.taps(token2.address), 10)

              assert.equal(await tap.lastTapUpdates(ETH), getTimestamp(receipt4))
              assert.equal(await tap.lastTapUpdates(token1.address), getTimestamp(receipt5))
              assert.equal(await tap.lastTapUpdates(token2.address), getTimestamp(receipt6))
            })
          })

          context('> but increase is above monthly limit', () => {
            it('it should revert', async () => {
              await tap.addTokenTap(ETH, 10, { from: authorized })
              await tap.addTokenTap(token1.address, 20, { from: authorized })
              // 1 month = 2592000 seconds
              await timeTravel(2592000)

              await assertRevert(() => tap.updateTokenTap(ETH, 16, { from: authorized }))
              await assertRevert(() => tap.updateTokenTap(token1.address, 31, { from: authorized }))
            })
          })
        })

        context('> but new tap rate is zero', () => {
          it('it should revert', async () => {
            await tap.addTokenTap(ETH, 10, { from: authorized })
            await tap.addTokenTap(token1.address, 20, { from: authorized })
            // 1 month = 2592000 seconds
            await timeTravel(2592000)

            await assertRevert(() => tap.updateTokenTap(ETH, 0, { from: authorized }))
            await assertRevert(() => tap.updateTokenTap(token1.address, 0, { from: authorized }))
          })
        })
      })

      context('> but token does not exist', () => {
        it('it should revert', async () => {
          const token = await TokenMock.new(authorized, 10000)

          await assertRevert(() => tap.updateTokenTap(token.address, 10, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_TOKEN_TAP_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTokenTap(ETH, 10, { from: authorized })

        await assertRevert(() => tap.updateTokenTap(ETH, 9, { from: unauthorized }))
      })
    })
  })

  context('> #getMaxWithdrawal', () => {
    context('> tapped amount is inferior to pool balance', () => {
      it('it should return tapped amount', async () => {
        await tap.addTokenTap(ETH, 1, { from: authorized })
        await tap.addTokenTap(token1.address, 2, { from: authorized })
        await timeTravel(10)

        assert.equal((await tap.getMaxWithdrawal(ETH)).toNumber(), 10)
        assert.equal((await tap.getMaxWithdrawal(token1.address)).toNumber(), 20)
      })
    })

    context('> tapped amount is superior to pool balance', () => {
      it('it should return pool balance', async () => {
        await tap.addTokenTap(ETH, 4, { from: authorized })
        await tap.addTokenTap(token1.address, 5, { from: authorized })
        await timeTravel(400)

        assert.equal((await tap.getMaxWithdrawal(ETH)).toNumber(), INITIAL_ETH_BALANCE)
        assert.equal((await tap.getMaxWithdrawal(token1.address)).toNumber(), INITIAL_TOKEN_BALANCE)
      })
    })
  })

  context('> #withdraw', () => {
    context('> sender has WITHDRAW_ROLE', () => {
      context(' > and tap is defined for token', () => {
        context(' > and pool balance is not zero for token', () => {
          context('> ETH', () => {
            it('it should transfer a tapped amount of ETH from the pool to the vault', async () => {
              const receipt1 = await tap.addTokenTap(ETH, 2, { from: authorized })
              const timestamp1 = getTimestamp(receipt1)
              await timeTravel(10)

              // first withdrawal
              const receipt2 = await tap.withdraw(ETH, { from: authorized })
              const timestamp2 = await getTimestamp(receipt2)
              const diff1 = timestamp2 - timestamp1
              assertEvent(receipt2, 'Withdraw')
              assert.equal((await getBalance(pool.address)).toNumber(), INITIAL_ETH_BALANCE - 2 * diff1)
              assert.equal((await getBalance(vault.address)).toNumber(), 2 * diff1)
              assert.equal(await tap.lastWithdrawals(ETH), getTimestamp(receipt1) + diff1)

              // let's time travel and withdraw again
              await timeTravel(5)
              const receipt3 = await tap.withdraw(ETH, { from: authorized })
              const timestamp3 = await getTimestamp(receipt3)
              const diff2 = timestamp3 - timestamp1
              assertEvent(receipt3, 'Withdraw')
              assert.equal((await getBalance(pool.address)).toNumber(), INITIAL_ETH_BALANCE - 2 * diff2)
              assert.equal((await getBalance(vault.address)).toNumber(), 2 * diff2)
              assert.equal(await tap.lastWithdrawals(ETH), getTimestamp(receipt1) + diff2)
            })
          })

          context('> ERC20', () => {
            it('it should transfer a tapped amount of ERC20 from the pool to the vault', async () => {
              const receipt1 = await tap.addTokenTap(token1.address, 2, { from: authorized })
              const timestamp1 = getTimestamp(receipt1)
              await timeTravel(10)

              // first withdrawal
              const receipt2 = await tap.withdraw(token1.address, { from: authorized })
              const timestamp2 = await getTimestamp(receipt2)
              const diff1 = timestamp2 - timestamp1
              assertEvent(receipt2, 'Withdraw')
              assert.equal((await token1.balanceOf(pool.address)).toNumber(), INITIAL_TOKEN_BALANCE - 2 * diff1)
              assert.equal((await token1.balanceOf(vault.address)).toNumber(), 2 * diff1)
              assert.equal(await tap.lastWithdrawals(token1.address), getTimestamp(receipt1) + diff1)

              // let's time travel and withdraw again
              await timeTravel(5)
              const receipt3 = await tap.withdraw(token1.address, { from: authorized })
              const timestamp3 = await getTimestamp(receipt3)
              const diff2 = timestamp3 - timestamp1
              assertEvent(receipt3, 'Withdraw')
              assert.equal((await token1.balanceOf(pool.address)).toNumber(), INITIAL_TOKEN_BALANCE - 2 * diff2)
              assert.equal((await token1.balanceOf(vault.address)).toNumber(), 2 * diff2)
              assert.equal(await tap.lastWithdrawals(token1.address), getTimestamp(receipt1) + diff2)
            })
          })
        })

        context(' > but pool balance is zero for token', () => {
          it('it should revert', async () => {
            const token = await TokenMock.new(pool.address, 0)
            await tap.addTokenTap(token.address, 1000, { from: authorized })

            await assertRevert(() => tap.withdraw(token.address, { from: authorized }))
          })
        })
      })

      context(' > but tap is not defined for token', () => {
        it('it should revert', async () => {
          const token = await TokenMock.new(pool.address, INITIAL_TOKEN_BALANCE)

          await assertRevert(() => tap.withdraw(token.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have WITHDRAW_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTokenTap(ETH, 2, { from: authorized })
        await timeTravel(10)

        await assertRevert(() => tap.withdraw(ETH, { from: unauthorized }))
      })
    })
  })
})
