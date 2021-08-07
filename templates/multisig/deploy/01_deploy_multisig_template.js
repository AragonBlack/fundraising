const func = async function (hre) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, get, read } = deployments;

  const { deployer } = await getNamedAccounts();

  const daoFactory = await get("DAOFactory");
  const ensAddress = await read(
    "APMRegistryFactory",
    { from: deployer },
    "ens"
  );
  const minimeFactory = await get("MiniMeTokenFactory");
  const aragonID = await get("FIFSResolvingRegistrar");

  await deploy("multisigTemplate", {
    from: deployer,
    args: [
      daoFactory.address,
      ensAddress,
      minimeFactory.address,
      aragonID.address,
    ],
    log: true,
    deterministicDeployment: true,
  });
};

module.exports = func;