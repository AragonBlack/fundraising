pragma solidity 0.4.24;

import "@aragon/os/contracts/acl/ACL.sol";
import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/os/contracts/factory/EVMScriptRegistryFactory.sol";
import "@aragon/os/contracts/kernel/Kernel.sol";
import "@aragon/apps-shared-migrations/contracts/Migrations.sol";
import "@ablack/fundraising-aragon-fundraising/contracts/AragonFundraisingController.sol";
import "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";


// HACK to workaround truffle artifact loading on dependencies
contract TestImports {
  constructor() public {
    // to avoid lint error
  }
}
