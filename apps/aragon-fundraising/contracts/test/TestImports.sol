pragma solidity 0.4.24;

import "@aragon/os/contracts/acl/ACL.sol";
import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/os/contracts/kernel/Kernel.sol";
import "@aragon/apps-shared-migrations/contracts/Migrations.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";
import "@aragon/test-helpers/contracts/TokenMock.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";
import "@ablack/fundraising-bancor-formula/contracts/BancorFormula.sol";
import "@ablack/fundraising-shared-test-helpers/contracts/ForceSendETH.sol";


// HACK to workaround truffle artifact loading on dependencies
contract TestImports {
  constructor() public {
    // to avoid lint error
  }
}
