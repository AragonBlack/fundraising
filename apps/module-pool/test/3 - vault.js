/* eslint-disable no-undef */
// Test that Pool is a fully functioning Vault by running the same tests against the Pool app
const runSharedVaultTests = require('@aragon/apps-vault/test/vault_shared.js')

contract('Pool app (Vault compatibility)', accounts => {
  runSharedVaultTests('Pool', { accounts, artifacts, web3 })
})
