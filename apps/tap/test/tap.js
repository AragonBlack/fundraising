const Kernel = artifacts.require('Kernel')
const ACL = artifacts.require('ACL')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const Controller = artifacts.require('AragonFundraisingControllerMock')
const Vault = artifacts.require('Vault')
const Tap = artifacts.require('Tap')
const TokenMock = artifacts.require('TokenMock')
const ForceSendETH = artifacts.require('ForceSendETH')

const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const blockNumber = require('@aragon/test-helpers/blockNumber')(web3)
const getBalance = require('@aragon/test-helpers/balance')(web3)
const assertEvent = require('@aragon/test-helpers/assertEvent')
const timeTravel = require('@aragon/test-helpers/timeTravel')(web3)
const { hash } = require('eth-ens-namehash')
const { getEvent } = require('@ablack/fundraising-shared-test-helpers/events')
const { NULL_ADDRESS } = require('@ablack/fundraising-shared-test-helpers/constants')
const increaseBlocks = require('@ablack/fundraising-shared-test-helpers/increaseBlocks')(web3)

const { MAXIMUM_TAP_FLOOR_DECREASE_PCT } = require('@ablack/fundraising-shared-test-helpers/constants')

const getTimestamp = receipt => {
  return web3.eth.getBlock(receipt.receipt.blockNumber).timestamp
}

const getBatchId = receipt => {
  const blocknumber = web3.eth.getBlock(receipt.receipt.blockNumber).number

  return Math.floor(blocknumber / BATCH_BLOCKS) * BATCH_BLOCKS
}

const VAULT_ID = hash('vault.aragonpm.eth')
const TAP_ID = hash('tap.aragonpm.eth')

const { ETH } = require('@ablack/fundraising-shared-test-helpers/constants')

const BATCH_BLOCKS = 10
const INITIAL_ETH_BALANCE = 100000000
const INITIAL_TOKEN_BALANCE = 100000000
const MAX_TAP_RATE_INCREASE_PCT = 50 * Math.pow(10, 16)

const progressToNextBatch = require('@ablack/fundraising-shared-test-helpers/progressToNextBatch')(web3, BATCH_BLOCKS)

contract('Tap app', accounts => {
  let factory, dao, acl, vBase, tBase, controller, reserve, beneficiary, tap, token1, token2
  let APP_MANAGER_ROLE,
    TRANSFER_ROLE,
    UPDATE_CONTROLLER_ROLE,
    UPDATE_RESERVE_ROLE,
    UPDATE_BENEFICIARY_ROLE,
    UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE,
    UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE,
    ADD_TAPPED_TOKEN_ROLE,
    REMOVE_TAPPED_TOKEN_ROLE,
    UPDATE_TAPPED_TOKEN_ROLE,
    RESET_TAPPED_TOKEN_ROLE,
    WITHDRAW_ROLE

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  const forceSendETH = async (to, value) => {
    // Using this contract ETH will be send by selfdestruct which always succeeds
    const forceSend = await ForceSendETH.new()
    return forceSend.sendByDying(to, { value })
  }

  const initialize = async _ => {
    // DAO
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })
    // reserve
    const rReceipt = await dao.newAppInstance(VAULT_ID, vBase.address, '0x', false)
    reserve = await Vault.at(getEvent(rReceipt, 'NewAppProxy', 'proxy'))
    // beneficiary
    const bReceipt = await dao.newAppInstance(VAULT_ID, vBase.address, '0x', false)
    beneficiary = await Vault.at(getEvent(bReceipt, 'NewAppProxy', 'proxy'))
    // tap
    const tReceipt = await dao.newAppInstance(TAP_ID, tBase.address, '0x', false)
    tap = await Tap.at(getEvent(tReceipt, 'NewAppProxy', 'proxy'))
    // permissions
    await acl.createPermission(tap.address, reserve.address, TRANSFER_ROLE, root, { from: root })
    await acl.grantPermission(root, reserve.address, TRANSFER_ROLE, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_CONTROLLER_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_RESERVE_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_BENEFICIARY_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, ADD_TAPPED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, REMOVE_TAPPED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, UPDATE_TAPPED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, RESET_TAPPED_TOKEN_ROLE, root, { from: root })
    await acl.createPermission(authorized, tap.address, WITHDRAW_ROLE, root, { from: root })
    // initializations
    await reserve.initialize()
    await beneficiary.initialize()
    await tap.initialize(controller.address, reserve.address, beneficiary.address, BATCH_BLOCKS, MAX_TAP_RATE_INCREASE_PCT, MAXIMUM_TAP_FLOOR_DECREASE_PCT)
    // balances
    await forceSendETH(reserve.address, INITIAL_ETH_BALANCE)
    token1 = await TokenMock.new(reserve.address, INITIAL_TOKEN_BALANCE)
    token2 = await TokenMock.new(reserve.address, INITIAL_TOKEN_BALANCE)
  }

  before(async () => {
    // factory
    const kBase = await Kernel.new(true) // petrify immediately
    const aBase = await ACL.new()
    const rFact = await EVMScriptRegistryFactory.new()
    factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)
    // base contracts
    controller = await Controller.new()
    vBase = await Vault.new()
    tBase = await Tap.new()
    // constants
    // ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    NULL_ADDR = ETH
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    TRANSFER_ROLE = await vBase.TRANSFER_ROLE()
    UPDATE_CONTROLLER_ROLE = await tBase.UPDATE_CONTROLLER_ROLE()
    UPDATE_RESERVE_ROLE = await tBase.UPDATE_RESERVE_ROLE()
    UPDATE_BENEFICIARY_ROLE = await tBase.UPDATE_BENEFICIARY_ROLE()
    UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE = await tBase.UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE()
    UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = await tBase.UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE()
    ADD_TAPPED_TOKEN_ROLE = await tBase.ADD_TAPPED_TOKEN_ROLE()
    REMOVE_TAPPED_TOKEN_ROLE = await tBase.REMOVE_TAPPED_TOKEN_ROLE()
    UPDATE_TAPPED_TOKEN_ROLE = await tBase.UPDATE_TAPPED_TOKEN_ROLE()
    RESET_TAPPED_TOKEN_ROLE = await tBase.RESET_TAPPED_TOKEN_ROLE()
    WITHDRAW_ROLE = await tBase.WITHDRAW_ROLE()
  })

  beforeEach(async () => {
    await initialize()
  })

  context('> #deploy', () => {
    it('it should deploy', async () => {
      await Tap.new()
    })
  })

  context('> #initialize', () => {
    context('> initialization parameters valid', () => {
      it('it should initialize tap', async () => {
        assert.equal(await tap.controller(), controller.address)
        assert.equal(await tap.reserve(), reserve.address)
        assert.equal(await tap.beneficiary(), beneficiary.address)
        assert.equal(await tap.batchBlocks(), BATCH_BLOCKS)
        assert.equal(await tap.maximumTapRateIncreasePct(), MAX_TAP_RATE_INCREASE_PCT)
        assert.equal(await tap.maximumTapFloorDecreasePct(), MAXIMUM_TAP_FLOOR_DECREASE_PCT)
      })
    })

    context('> initialization parameters are invalid', () => {
      it('it should revert', async () => {
        const dReceipt = await factory.newDAO(root)
        const dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
        const acl = ACL.at(await dao.acl())
        await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, { from: root })

        const _tReceipt = await dao.newAppInstance(TAP_ID, tBase.address, '0x', false)
        const _tap = await Tap.at(getEvent(_tReceipt, 'NewAppProxy', 'proxy'))

        await assertRevert(() =>
          _tap.initialize(root, reserve.address, beneficiary.address, BATCH_BLOCKS, MAX_TAP_RATE_INCREASE_PCT, MAXIMUM_TAP_FLOOR_DECREASE_PCT)
        )
        await assertRevert(() =>
          _tap.initialize(controller.address, root, beneficiary.address, BATCH_BLOCKS, MAX_TAP_RATE_INCREASE_PCT, MAXIMUM_TAP_FLOOR_DECREASE_PCT)
        )
        await assertRevert(() =>
          _tap.initialize(controller.address, reserve.address, NULL_ADDR, BATCH_BLOCKS, MAX_TAP_RATE_INCREASE_PCT, MAXIMUM_TAP_FLOOR_DECREASE_PCT)
        )
        await assertRevert(() =>
          _tap.initialize(controller.address, reserve.address, beneficiary.address, 0, MAX_TAP_RATE_INCREASE_PCT, MAXIMUM_TAP_FLOOR_DECREASE_PCT)
        )
      })
    })

    it('it should revert on re-initialization', async () => {
      await assertRevert(() =>
        tap.initialize(controller.address, reserve.address, beneficiary.address, BATCH_BLOCKS, MAX_TAP_RATE_INCREASE_PCT, MAXIMUM_TAP_FLOOR_DECREASE_PCT, {
          from: root,
        })
      )
    })
  })

  context('> #updateController', () => {
    context('> sender has UPDATE_CONTROLLER_ROLE', () => {
      context('> and new controller is a contract', () => {
        it('it should update controller', async () => {
          const newController = await Controller.new()
          const receipt = await tap.updateController(newController.address, { from: authorized })

          assertEvent(receipt, 'UpdateController')
          assert.equal(await tap.controller(), newController.address)
        })
      })

      context('> but new controller is not a contract', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.updateController(root, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_CONTROLLER_ROLE', () => {
      it('it should revert', async () => {
        const newController = await Controller.new()
        await assertRevert(() => tap.updateController(newController.address, { from: unauthorized }))
      })
    })
  })

  context('> #updateReserve', () => {
    context('> sender has UPDATE_RESERVE_ROLE', () => {
      context('> and new reserve is a contract', () => {
        it('it should update reserve', async () => {
          const newReserve = await Vault.new()
          const receipt = await tap.updateReserve(newReserve.address, { from: authorized })

          assertEvent(receipt, 'UpdateReserve')
          assert.equal(await tap.reserve(), newReserve.address)
        })
      })

      context('> but new reserve is not a contract', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.updateReserve(root, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_RESERVE_ROLE', () => {
      it('it should revert', async () => {
        const newReserve = await Vault.new()
        await assertRevert(() => tap.updateReserve(newReserve.address, { from: unauthorized }))
      })
    })
  })

  context('> #updateBeneficiary', () => {
    context('> sender has UPDATE_BENEFICIARY_ROLE', () => {
      context('> and new beneficiary is valid', () => {
        it('it should update beneficiary', async () => {
          const newBeneficiary = await Vault.new()
          const receipt = await tap.updateBeneficiary(newBeneficiary.address, { from: authorized })

          assertEvent(receipt, 'UpdateBeneficiary')
          assert.equal(await tap.beneficiary(), newBeneficiary.address)
        })
      })

      context('> but new beneficiary is not valid', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.updateBeneficiary(NULL_ADDR, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_BENEFICIARY_ROLE', () => {
      it('it should revert', async () => {
        const newBeneficiary = await Vault.new()
        await assertRevert(() => tap.updateBeneficiary(newBeneficiary.address, { from: unauthorized }))
      })
    })
  })

  context('> #updateMaximumTapRateIncreasePct', () => {
    context('> sender has UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE', () => {
      it('it should update maximum tap rate increase percentage', async () => {
        const receipt = await tap.updateMaximumTapRateIncreasePct(70 * Math.pow(10, 16), { from: authorized })

        assertEvent(receipt, 'UpdateMaximumTapRateIncreasePct')
        assert.equal(await tap.maximumTapRateIncreasePct(), 70 * Math.pow(10, 16))
      })
    })

    context('> sender does not have UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => tap.updateMaximumTapRateIncreasePct(70 * Math.pow(10, 16), { from: unauthorized }))
      })
    })
  })

  context('> #updateMaximumTapFloorDecreasePct', () => {
    context('> sender has UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE', () => {
      it('it should update maximum tap floor decrease percentage', async () => {
        const receipt = await tap.updateMaximumTapFloorDecreasePct(70 * Math.pow(10, 16), { from: authorized })

        assertEvent(receipt, 'UpdateMaximumTapFloorDecreasePct')
        assert.equal(await tap.maximumTapFloorDecreasePct(), 70 * Math.pow(10, 16))
      })
    })

    context('> sender does not have UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => tap.updateMaximumTapFloorDecreasePct(70 * Math.pow(10, 16), { from: unauthorized }))
      })
    })
  })

  context('> #addTappedToken', () => {
    context('> sender has ADD_TAPPED_TOKEN_ROLE', () => {
      context('> and token is ERC20 or ETH', () => {
        context('> and token is not yet tapped', () => {
          context('> and tap rate is above zero', () => {
            it('it should add tapped token', async () => {
              const receipt1 = await tap.addTappedToken(ETH, 10, 15, { from: authorized })
              const receipt2 = await tap.addTappedToken(token1.address, 50, 25, { from: authorized })
              const receipt3 = await tap.addTappedToken(token2.address, 100, 40, { from: authorized })

              const batchId1 = getBatchId(receipt1)
              const batchId2 = getBatchId(receipt2)
              const batchId3 = getBatchId(receipt3)

              const timestamp1 = getTimestamp(receipt1)
              const timestamp2 = getTimestamp(receipt2)
              const timestamp3 = getTimestamp(receipt3)

              assertEvent(receipt1, 'AddTappedToken')
              assertEvent(receipt2, 'AddTappedToken')
              assertEvent(receipt3, 'AddTappedToken')

              assert.equal(await tap.rates(ETH), 10)
              assert.equal(await tap.rates(token1.address), 50)
              assert.equal(await tap.rates(token2.address), 100)

              assert.equal(await tap.floors(ETH), 15)
              assert.equal(await tap.floors(token1.address), 25)
              assert.equal(await tap.floors(token2.address), 40)

              assert.equal(await tap.lastWithdrawals(ETH), batchId1)
              assert.equal(await tap.lastWithdrawals(token1.address), batchId2)
              assert.equal(await tap.lastWithdrawals(token2.address), batchId3)

              assert.equal(await tap.lastTapUpdates(ETH), timestamp1)
              assert.equal(await tap.lastTapUpdates(token1.address), timestamp2)
              assert.equal(await tap.lastTapUpdates(token2.address), timestamp3)
            })

            it('it should re-add tapped token that has been un-tapped', async () => {
              const receipt1 = await tap.addTappedToken(token1.address, 50, 30, { from: authorized })
              const batchId1 = getBatchId(receipt1)
              const timestamp1 = getTimestamp(receipt1)

              assertEvent(receipt1, 'AddTappedToken')
              assert.equal(await tap.rates(token1.address), 50)
              assert.equal(await tap.floors(token1.address), 30)
              assert.equal(await tap.lastWithdrawals(token1.address), batchId1)
              assert.equal(await tap.lastTapUpdates(token1.address), timestamp1)

              await tap.removeTappedToken(token1.address, { from: authorized })
              const receipt2 = await tap.addTappedToken(token1.address, 100, 70, { from: authorized })
              const batchId2 = getBatchId(receipt2)
              const timestamp2 = getTimestamp(receipt2)

              assertEvent(receipt2, 'AddTappedToken')
              assert.equal(await tap.rates(token1.address), 100)
              assert.equal(await tap.floors(token1.address), 70)
              assert.equal(await tap.lastWithdrawals(token1.address), batchId2)
              assert.equal(await tap.lastTapUpdates(token1.address), timestamp2)
            })
          })

          context('> but tap rate is zero', () => {
            it('it should revert', async () => {
              await assertRevert(() => tap.addTappedToken(ETH, 0, 4, { from: authorized }))
              await assertRevert(() => tap.addTappedToken(token1.address, 0, 5, { from: authorized }))
            })
          })
        })

        context('> but token is already tapped', () => {
          it('it should revert', async () => {
            await tap.addTappedToken(ETH, 10, 25, { from: authorized })
            await tap.addTappedToken(token1.address, 50, 40, { from: authorized })

            await assertRevert(() => tap.addTappedToken(ETH, 10, 35, { from: authorized }))
            await assertRevert(() => tap.addTappedToken(token1.address, 50, 24, { from: authorized }))
          })
        })
      })

      context('> but token is not ERC20 or ETH', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.addTappedToken(root, 50, 10, { from: authorized }))
        })
      })
    })

    context('> sender does not have ADD_TAPPED_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await assertRevert(() => tap.addTappedToken(ETH, 10, 10, { from: unauthorized }))
        await assertRevert(() => tap.addTappedToken(token1.address, 50, 10, { from: unauthorized }))
      })
    })
  })

  context('> #removeTappedToken', () => {
    context('> sender has REMOVE_TAPPED_TOKEN_ROLE', () => {
      context('> and token is tapped', () => {
        it('it should remove tapped token', async () => {
          await tap.addTappedToken(ETH, 10, 5, { from: authorized })
          await tap.addTappedToken(token1.address, 50, 5, { from: authorized })

          const receipt1 = await tap.removeTappedToken(ETH, { from: authorized })
          const receipt2 = await tap.removeTappedToken(token1.address, { from: authorized })

          assertEvent(receipt1, 'RemoveTappedToken')
          assertEvent(receipt2, 'RemoveTappedToken')
          assert.equal(await tap.rates(ETH), 0)
          assert.equal(await tap.rates(token1.address), 0)
          assert.equal(await tap.floors(ETH), 0)
          assert.equal(await tap.floors(token1.address), 0)
          assert.equal(await tap.lastWithdrawals(ETH), 0)
          assert.equal(await tap.lastWithdrawals(token1.address), 0)
          assert.equal(await tap.lastTapUpdates(ETH), 0)
          assert.equal(await tap.lastTapUpdates(token1.address), 0)
        })
      })

      context('> but token is not tapped', () => {
        it('it should revert', async () => {
          await assertRevert(async () => tap.removeTappedToken(ETH, { from: authorized }))
          await assertRevert(async () => tap.removeTappedToken(token1.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have REMOVE_TAPPED_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTappedToken(ETH, 10, 5, { from: authorized })
        await tap.addTappedToken(token1.address, 50, 5, { from: authorized })

        await assertRevert(() => tap.removeTappedToken(ETH, { from: unauthorized }))
        await assertRevert(() => tap.removeTappedToken(token1.address, { from: unauthorized }))
      })
    })
  })

  context('> #updateTappedToken', () => {
    context('> sender has UPDATE_TAPPED_TOKEN_ROLE', () => {
      context('> and token is tapped', () => {
        context('> and new tap rate is above zero', () => {
          context('> and tap has not been updated in the last 30 days', () => {
            context('> and new tap rate is lower than old tap', () => {
              context('> and new tap floor is higher than old tap', () => {
                it('it should withdraw funds', async () => {
                  await tap.addTappedToken(ETH, 10, 5, { from: authorized })
                  await tap.addTappedToken(token1.address, 5000, 5, { from: authorized })

                  await progressToNextBatch()

                  const withdrawalETH = await tap.getMaximumWithdrawal(ETH)
                  const withdrawalERC20 = await tap.getMaximumWithdrawal(token1.address)

                  const receipt1 = await tap.updateTappedToken(ETH, 10, 10, { from: authorized })
                  const receipt2 = await tap.updateTappedToken(token1.address, 5000, 7, { from: authorized })

                  assertEvent(receipt1, 'Withdraw')
                  assert.equal(await tap.lastWithdrawals(ETH), getBatchId(receipt1))
                  assert.equal((await getBalance(reserve.address)).toNumber(), INITIAL_ETH_BALANCE - withdrawalETH)
                  assert.equal((await getBalance(beneficiary.address)).toNumber(), withdrawalETH)

                  assertEvent(receipt2, 'Withdraw')
                  assert.equal(await tap.lastWithdrawals(token1.address), getBatchId(receipt2))
                  assert.equal((await token1.balanceOf(reserve.address)).toNumber(), INITIAL_TOKEN_BALANCE - withdrawalERC20)
                  assert.equal((await token1.balanceOf(beneficiary.address)).toNumber(), withdrawalERC20)
                })

                it('it should update tapped token', async () => {
                  await tap.addTappedToken(ETH, 10, 5, { from: authorized })
                  await tap.addTappedToken(token1.address, 5000, 5, { from: authorized })

                  const receipt1 = await tap.updateTappedToken(ETH, 10, 10, { from: authorized })
                  const receipt2 = await tap.updateTappedToken(token1.address, 5000, 7, { from: authorized })

                  assertEvent(receipt1, 'UpdateTappedToken')
                  assertEvent(receipt2, 'UpdateTappedToken')

                  assert.equal(await tap.rates(ETH), 10)
                  assert.equal(await tap.rates(token1.address), 5000)

                  assert.equal(await tap.floors(ETH), 10)
                  assert.equal(await tap.floors(token1.address), 7)

                  assert.equal(await tap.lastTapUpdates(ETH), getTimestamp(receipt1))
                  assert.equal(await tap.lastTapUpdates(token1.address), getTimestamp(receipt2))
                })
              })

              context('> and new tap floor is lower than old tap', () => {
                context('> and tap floor decrease is below the allowed limit', () => {
                  it('it should withdraw funds', async () => {
                    await tap.addTappedToken(ETH, 10, 100, { from: authorized })
                    await tap.addTappedToken(token1.address, 5000, 100, { from: authorized })

                    // move forward of one month + 1 second [to avoid timeTravel inconsistency]
                    await timeTravel(2592001)
                    await progressToNextBatch()

                    const withdrawalETH = await tap.getMaximumWithdrawal(ETH)
                    const withdrawalERC20 = await tap.getMaximumWithdrawal(token1.address)

                    const receipt1 = await tap.updateTappedToken(ETH, 10, 41, { from: authorized })
                    const receipt2 = await tap.updateTappedToken(token1.address, 5000, 50, { from: authorized })

                    assertEvent(receipt1, 'Withdraw')
                    assert.equal(await tap.lastWithdrawals(ETH), getBatchId(receipt1))
                    assert.equal((await getBalance(reserve.address)).toNumber(), INITIAL_ETH_BALANCE - withdrawalETH)
                    assert.equal((await getBalance(beneficiary.address)).toNumber(), withdrawalETH)

                    assertEvent(receipt2, 'Withdraw')
                    assert.equal(await tap.lastWithdrawals(token1.address), getBatchId(receipt2))
                    assert.equal((await token1.balanceOf(reserve.address)).toNumber(), INITIAL_TOKEN_BALANCE - withdrawalERC20)
                    assert.equal((await token1.balanceOf(beneficiary.address)).toNumber(), withdrawalERC20)
                  })

                  it('it should update tapped token', async () => {
                    await tap.addTappedToken(ETH, 10, 100, { from: authorized })
                    await tap.addTappedToken(token1.address, 5000, 100, { from: authorized })
                    // move forward of one month + 1 second [to avoid timeTravel inconsistency]
                    await timeTravel(2592001)

                    const receipt1 = await tap.updateTappedToken(ETH, 10, 40, { from: authorized })
                    const receipt2 = await tap.updateTappedToken(token1.address, 5000, 50, { from: authorized })

                    assertEvent(receipt1, 'UpdateTappedToken')
                    assertEvent(receipt2, 'UpdateTappedToken')

                    assert.equal(await tap.rates(ETH), 10)
                    assert.equal(await tap.rates(token1.address), 5000)

                    assert.equal(await tap.floors(ETH), 40)
                    assert.equal(await tap.floors(token1.address), 50)

                    assert.equal(await tap.lastTapUpdates(ETH), getTimestamp(receipt1))
                    assert.equal(await tap.lastTapUpdates(token1.address), getTimestamp(receipt2))
                  })
                })

                context('> but tap floor decrease is below the allowed limit', () => {
                  it('it should revert', async () => {
                    await tap.addTappedToken(ETH, 10, 100, { from: authorized })
                    await tap.addTappedToken(token1.address, 5000, 100, { from: authorized })
                    // move forward of one month + 1 second [to avoid timeTravel inconsistency]
                    await timeTravel(2592001)

                    await assertRevert(() => tap.updateTappedToken(ETH, 10, 39, { from: authorized }))
                    await assertRevert(() => tap.updateTappedToken(token1.address, 5000, 20, { from: authorized }))
                  })
                })
              })
            })

            context('> and new tap rate is higher than old tap', () => {
              context('> and tap rate increase is below the allowed limit', () => {
                it('it should withdraw funds', async () => {
                  await tap.addTappedToken(ETH, 10, 5, { from: authorized })
                  await tap.addTappedToken(token1.address, 5000, 5, { from: authorized })

                  // move forward of one month + 1 second [to avoid timeTravel inconsistency]
                  await timeTravel(2592001)
                  await progressToNextBatch()

                  const withdrawalETH = await tap.getMaximumWithdrawal(ETH)
                  const withdrawalERC20 = await tap.getMaximumWithdrawal(token1.address)

                  const receipt1 = await tap.updateTappedToken(ETH, 14, 5, { from: authorized })
                  const receipt2 = await tap.updateTappedToken(token1.address, 7500, 5, { from: authorized })

                  assertEvent(receipt1, 'Withdraw')
                  assert.equal(await tap.lastWithdrawals(ETH), getBatchId(receipt1))
                  assert.equal((await getBalance(reserve.address)).toNumber(), INITIAL_ETH_BALANCE - withdrawalETH)
                  assert.equal((await getBalance(beneficiary.address)).toNumber(), withdrawalETH)

                  assertEvent(receipt2, 'Withdraw')
                  assert.equal(await tap.lastWithdrawals(token1.address), getBatchId(receipt2))
                  assert.equal((await token1.balanceOf(reserve.address)).toNumber(), INITIAL_TOKEN_BALANCE - withdrawalERC20)
                  assert.equal((await token1.balanceOf(beneficiary.address)).toNumber(), withdrawalERC20)
                })

                it('it should update tapped token', async () => {
                  await tap.addTappedToken(ETH, 10, 5, { from: authorized })
                  await tap.addTappedToken(token1.address, 5000, 5, { from: authorized })
                  // move forward of one month + 1 second [to avoid timeTravel inconsistency]
                  await timeTravel(2592001)

                  const receipt1 = await tap.updateTappedToken(ETH, 14, 5, { from: authorized })
                  const receipt2 = await tap.updateTappedToken(token1.address, 7500, 5, { from: authorized })

                  assertEvent(receipt1, 'UpdateTappedToken')
                  assertEvent(receipt2, 'UpdateTappedToken')

                  assert.equal(await tap.rates(ETH), 14)
                  assert.equal(await tap.rates(token1.address), 7500)

                  assert.equal(await tap.floors(ETH), 5)
                  assert.equal(await tap.floors(token1.address), 5)

                  assert.equal(await tap.lastTapUpdates(ETH), getTimestamp(receipt1))
                  assert.equal(await tap.lastTapUpdates(token1.address), getTimestamp(receipt2))
                })
              })

              context('> but tap rate increase is above the allowed limit', () => {
                it('it should revert', async () => {
                  await tap.addTappedToken(ETH, 10, 5, { from: authorized })
                  await tap.addTappedToken(token1.address, 5000, 5, { from: authorized })
                  // move forward of one month + 1 second [to avoid timeTravel inconsistency]
                  await timeTravel(2592001)

                  await assertRevert(() => tap.updateTappedToken(ETH, 16, 5, { from: authorized }))
                  await assertRevert(() => tap.updateTappedToken(token1.address, 7501, 5, { from: authorized }))
                })
              })
            })
          })

          context('> but tap has been updated in the last 30 days', () => {
            it('it should revert', async () => {
              await tap.addTappedToken(ETH, 10, 5, { from: authorized })
              await tap.addTappedToken(token1.address, 50, 5, { from: authorized })
              // move forward of one month - 2 seconds [to avoid timeTravel inconsistency]
              await timeTravel(2591998)

              await assertRevert(() => tap.updateTappedToken(ETH, 11, 5, { from: authorized }))
              await assertRevert(() => tap.updateTappedToken(token1.address, 51, 5, { from: authorized }))
              await assertRevert(() => tap.updateTappedToken(ETH, 10, 4, { from: authorized }))
              await assertRevert(() => tap.updateTappedToken(token1.address, 50, 4, { from: authorized }))
            })
          })
        })

        context('> but new tap rate is zero', () => {
          it('it should revert', async () => {
            await tap.addTappedToken(ETH, 10, 5, { from: authorized })
            await tap.addTappedToken(token1.address, 50, 5, { from: authorized })
            // move forward of one month + 1 second [to avoid timeTravel inconsistency]
            await timeTravel(2592001)

            await assertRevert(() => tap.updateTappedToken(ETH, 0, 5, { from: authorized }))
            await assertRevert(() => tap.updateTappedToken(token1.address, 0, 5, { from: authorized }))
          })
        })
      })

      context('> but token is not tapped', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.updateTappedToken(ETH, 10, 5, { from: authorized }))
          await assertRevert(() => tap.updateTappedToken(token1.address, 50, 5, { from: authorized }))
        })
      })
    })

    context('> sender does not have UPDATE_TAPPED_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTappedToken(ETH, 10, 5, { from: authorized })
        await tap.addTappedToken(token1.address, 50, 5, { from: authorized })
        // move forward of one month + 1 second [to avoid timeTravel inconsistency]
        await timeTravel(2592001)

        await assertRevert(() => tap.updateTappedToken(ETH, 10, 5, { from: unauthorized }))
        await assertRevert(() => tap.updateTappedToken(token1.address, 50, 5, { from: unauthorized }))
      })
    })
  })

  context('> #resetTappedToken', () => {
    context('> sender has RESET_TAPPED_TOKEN_ROLE', () => {
      context('> and token is tapped', () => {
        it('it should reset tapped token', async () => {
          await tap.addTappedToken(ETH, 10, 5, { from: authorized })
          await tap.addTappedToken(token1.address, 5000, 7, { from: authorized })

          await increaseBlocks(150)

          const receipt1 = await tap.resetTappedToken(ETH, { from: authorized })
          const receipt2 = await tap.resetTappedToken(token1.address, { from: authorized })

          assertEvent(receipt1, 'ResetTappedToken')
          assertEvent(receipt2, 'ResetTappedToken')
          assert.equal(await tap.lastWithdrawals(ETH), getBatchId(receipt1))
          assert.equal(await tap.lastWithdrawals(token1.address), getBatchId(receipt2))
          assert.equal(await tap.lastTapUpdates(ETH), getTimestamp(receipt1))
          assert.equal(await tap.lastTapUpdates(token1.address), getTimestamp(receipt2))
        })
      })

      context('> but token is not tapped', () => {
        it('it should revert', async () => {
          await assertRevert(() => tap.resetTappedToken(ETH, { from: authorized }))
          await assertRevert(() => tap.resetTappedToken(token1.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have RESET_TAPPED_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTappedToken(ETH, 10, 5, { from: authorized })
        await tap.addTappedToken(token1.address, 5000, 7, { from: authorized })

        await assertRevert(() => tap.resetTappedToken(ETH, { from: unauthorized }))
        await assertRevert(() => tap.resetTappedToken(token1.address, { from: unauthorized }))
      })
    })
  })

  context('> #withdraw', () => {
    context('> sender has WITHDRAW_ROLE', () => {
      context('> and token is tapped', () => {
        context('> and maximum withdrawal is not zero', () => {
          context('> ETH', () => {
            it('it should transfer a tapped amount of ETH from reserve to beneficiary', async () => {
              await tap.addTappedToken(ETH, 10, 0, { from: authorized })

              await progressToNextBatch()
              await progressToNextBatch()

              const withdrawal = await tap.getMaximumWithdrawal(ETH)
              const receipt = await tap.withdraw(ETH, { from: authorized })
              const batchId = getBatchId(receipt)

              assertEvent(receipt, 'Withdraw')
              assert.equal(await tap.lastWithdrawals(ETH), batchId)
              assert.equal((await getBalance(reserve.address)).toNumber(), INITIAL_ETH_BALANCE - withdrawal)
              assert.equal((await getBalance(beneficiary.address)).toNumber(), withdrawal)
            })
          })

          context('> ERC20', () => {
            it('it should transfer a tapped amount of ERC20 from reserve to beneficiary', async () => {
              await tap.addTappedToken(token1.address, 10, 0, { from: authorized })

              await progressToNextBatch()
              await progressToNextBatch()

              const withdrawal = await tap.getMaximumWithdrawal(token1.address)
              const receipt = await tap.withdraw(token1.address, { from: authorized })
              const batchId = getBatchId(receipt)

              assertEvent(receipt, 'Withdraw')
              assert.equal(await tap.lastWithdrawals(token1.address), batchId)
              assert.equal((await token1.balanceOf(reserve.address)).toNumber(), INITIAL_TOKEN_BALANCE - withdrawal)
              assert.equal((await token1.balanceOf(beneficiary.address)).toNumber(), withdrawal)
            })
          })
        })

        context('> but maximum withdrawal is zero', () => {
          it('it should revert', async () => {
            const token = await TokenMock.new(reserve.address, 0)
            await tap.addTappedToken(token.address, 1000, 0, { from: authorized })
            await progressToNextBatch()

            await assertRevert(() => tap.withdraw(token.address, { from: authorized }))
          })
        })
      })

      context('> but token is not tapped', () => {
        it('it should revert', async () => {
          const token = await TokenMock.new(reserve.address, INITIAL_TOKEN_BALANCE)

          await assertRevert(() => tap.withdraw(token.address, { from: authorized }))
        })
      })
    })

    context('> sender does not have WITHDRAW_ROLE', () => {
      it('it should revert', async () => {
        await tap.addTappedToken(ETH, 2, 0, { from: authorized })
        await tap.addTappedToken(token1.address, 2, 0, { from: authorized })

        await progressToNextBatch()

        await assertRevert(() => tap.withdraw(ETH, { from: unauthorized }))
        await assertRevert(() => tap.withdraw(token1.address, { from: unauthorized }))
      })
    })
  })

  context('> #getMaximumWithdrawal', () => {
    context('tokens to hold + floor is inferior to balance', () => {
      context('> tapped amount + tokens to hold + floor is inferior to balance', () => {
        it('it should return a batched tapped amount', async () => {
          // start a new batch
          await progressToNextBatch()
          // add tapped tokens
          await tap.addTappedToken(ETH, 1, 2, { from: authorized })
          await tap.addTappedToken(token1.address, 2, 3, { from: authorized })
          // move two batches further
          await progressToNextBatch()
          await progressToNextBatch()
          // test maximum withdrawal
          assert.equal((await tap.getMaximumWithdrawal(ETH)).toNumber(), 1 * 2 * BATCH_BLOCKS)
          assert.equal((await tap.getMaximumWithdrawal(token1.address)).toNumber(), 2 * 2 * BATCH_BLOCKS)
          // move of a few blocks in the same batch
          await increaseBlocks(5)
          // test maximum withdrawal
          assert.equal((await tap.getMaximumWithdrawal(ETH)).toNumber(), 1 * 2 * BATCH_BLOCKS)
          assert.equal((await tap.getMaximumWithdrawal(token1.address)).toNumber(), 2 * 2 * BATCH_BLOCKS)
          // move the next batch
          await progressToNextBatch()
          // test maximum withdrawal
          assert.equal((await tap.getMaximumWithdrawal(ETH)).toNumber(), 1 * 3 * BATCH_BLOCKS)
          assert.equal((await tap.getMaximumWithdrawal(token1.address)).toNumber(), 2 * 3 * BATCH_BLOCKS)
        })
      })

      context('> tapped amount + tokens to hold + floor is superior to balance ', () => {
        it('it should return a smaller batched tapped amount to save enough collateral', async () => {
          // start a new batch
          await progressToNextBatch()
          // add tapped tokens
          await tap.addTappedToken(ETH, INITIAL_ETH_BALANCE / 10, 1500, { from: authorized })
          await tap.addTappedToken(token1.address, INITIAL_TOKEN_BALANCE / 10, 150, { from: authorized })
          // move to next batch
          await progressToNextBatch()
          await progressToNextBatch()
          // test maximum withdrawal
          // mock SimpleMarketMakerController enforces 5 ETH and 10 tokens to be hold
          assert.equal((await tap.getMaximumWithdrawal(ETH)).toNumber(), INITIAL_ETH_BALANCE - 5 - 1500)
          assert.equal((await tap.getMaximumWithdrawal(token1.address)).toNumber(), INITIAL_TOKEN_BALANCE - 10 - 150)
        })
      })
    })

    context('tokens to hold + floor is superior to balance', () => {
      it('it should return zero', async () => {
        // move funds out of the reserve
        // mock SimpleMarketMakerController enforces 5 ETH and 10 tokens to be hold
        await reserve.transfer(ETH, root, INITIAL_ETH_BALANCE - 1500 - 5)
        await reserve.transfer(token1.address, root, INITIAL_TOKEN_BALANCE - 150 - 9)
        // start a new batch
        await progressToNextBatch()
        // add tapped tokens
        await tap.addTappedToken(ETH, 25, 1500, { from: authorized })
        await tap.addTappedToken(token1.address, 40, 150, { from: authorized })
        // move to next batch
        await progressToNextBatch()
        // test maximum withdrawal
        assert.equal((await tap.getMaximumWithdrawal(ETH)).toNumber(), 0)
        assert.equal((await tap.getMaximumWithdrawal(token1.address)).toNumber(), 0)
      })
    })
  })
})
