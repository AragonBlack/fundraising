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

const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const DestinationMock = artifacts.require('DestinationMock')
const KernelDepositableMock = artifacts.require('KernelDepositableMock')

const NULL_ADDRESS = '0x00'

contract('Tap app', accounts => {
  let daoFact, agentBase, agent, agentAppId, tapBase, vaultBase

  let ETH,
    ANY_ENTITY,
    APP_MANAGER_ROLE,
    EXECUTE_ROLE,
    RUN_SCRIPT_ROLE,
    ADD_PRESIGNED_HASH_ROLE,
    DESIGNATE_SIGNER_ROLE,
    ERC1271_INTERFACE_ID

  const root = accounts[0]
  //const authorized = accounts[1]
  //const unauthorized = accounts[2]

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

    const ethConstant = await EtherTokenConstantMock.new()
    ETH = await ethConstant.getETHConstant()
  })

  beforeEach(async () => {
    const r = await daoFact.newDAO(root)
    const dao = await Kernel.at(getEvent(r, 'DeployDAO', 'dao'))
    const acl = await ACL.at(await dao.acl())

    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, {
      from: root
    })

    // vault
    vaultId = hash('vault.aragonpm.eth')
    const vReceipt = await dao.newAppInstance(
      vaultId,
      vaultBase.address,
      '0x',
      false
    )
    vault = await Vault.at(getEvent(vReceipt, 'NewAppProxy', 'proxy'))

    // pool
    poolId = hash('fundraising-pool.aragonpm.eth')
    const pReceipt = await dao.newAppInstance(
      poolId,
      poolBase.address,
      '0x',
      false
    )
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))

    // tap
    tapAppId = hash('fundraising-tap.aragonpm.test')
    const tapReceipt = await dao.newAppInstance(
        tapAppId,
        tapBase.address,
      '0x',
      false
    )
    tap = await Tap.at(getEvent(tapReceipt, 'NewAppProxy', 'proxy'))

    //Set up agent
    agentAppId = hash('fundraising-tap.aragonpm.test')
    const agentReceipt = await dao.newAppInstance(
      agentAppId,
      agentBase.address,
      '0x',
      false
    )
    const agentProxyAddress = getEvent(agentReceipt, 'NewAppProxy', 'proxy')
    agent = await Agent.at(agentProxyAddress)

    await agent.initialize()
    await pool.initialize()
    await vault.initialize()
    await tap.initialize()
  })

  context("initialize", () => {
    it("should initialize tap rate, collateral pool and vault", async () => {
    });

    it("should revert on re-initialization", async () => {
      const newTap = await Tap.new()
      assert.isTrue(await newTap.isPetrified())
      return assertRevert(async () => {
        await newTap.initialize()
      })
    });
  });

  context("withdraw", () => {
    context("ETH", () => {
      it("should transfer a tap-defined amount of ETH from the collateral pool to the vault", async () => {});
    });

    context("ERC20", () => {
      it("should transfer a tap-defined amount of ERC20 from the collateral pool to the vault", async () => {});
    });

    it("it should revert if sender does not have 'WITHDRAW_ROLE'", async () => {});
  });

  context("updateTap", () => {
    it("should update tap rate", async () => {});
  });

  context("updateVault", () => {
    it("should update vault address", async () => {});
  });

  context("updateCollateralPool", () => {
    it("should update collateral pool address", async () => {});
  });
})

