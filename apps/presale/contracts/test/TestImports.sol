pragma solidity 0.4.24;

import "@aragon/apps-shared-migrations/contracts/Migrations.sol";

import "@aragon/os/contracts/acl/ACL.sol";
import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/os/contracts/factory/EVMScriptRegistryFactory.sol";
import "@aragon/os/contracts/kernel/Kernel.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";

import "@aragon/apps-vault/contracts/Vault.sol";
import "@aragon/apps-agent/contracts/Agent.sol";

import "@ablack/fundraising-shared-test-helpers/contracts/AragonFundraisingControllerMock.sol";
import "@ablack/fundraising-tap/contracts/Tap.sol";
import "@ablack/fundraising-batched-bancor-market-maker/contracts/BatchedBancorMarketMaker.sol";


// HACK to workaround truffle artifact loading on dependencies
contract TestImports {
    constructor() public {
        // solium-disable-previous-line no-empty-blocks
    }
}
