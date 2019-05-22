pragma solidity 0.4.24;

import "@aragon/os/contracts/kernel/Kernel.sol";
import "@aragon/os/contracts/acl/ACL.sol";
import "@aragon/os/contracts/factory/DAOFactory.sol";
import "@aragon/apps-shared-minime/contracts/MiniMeToken.sol";
import "@aragon/apps-token-manager/contracts/TokenManager.sol";

import "@aragon/apps-shared-migrations/contracts/Migrations.sol";
import "@aragon/test-helpers/contracts/EtherTokenConstantMock.sol";
import "@aragon/test-helpers/contracts/TokenMock.sol";

import "@ablack/fundraising-module-pool/contracts/Pool.sol";
import "@ablack/fundraising-formula-bancor/contracts/BancorFormula.sol";

// You might think this file is a bit odd, but let me explain.
// We only use some contracts in our tests, which means Truffle
// will not compile it for us, because it is from an external
// dependency.
//
// We are now left with three options:
// - Copy/paste these contracts
// - Run the tests with `truffle compile --all` on
// - Or trick Truffle by claiming we use it in a Solidity test
//
// You know which one I went for.


contract TestImports {
  constructor() public {
    // to avoid lint error
  }
}
