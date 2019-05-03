/* eslint-disable no-undef */
// Test that Pool is a fully functioning Agent by running the same tests against the Pool app
const runSharedAgentTests = require('@aragon/apps-agent/test/agent_shared.js')

contract('Pool app (Agent compatibility)', accounts => {
  runSharedAgentTests('Pool', { accounts, artifacts, web3 })
})
