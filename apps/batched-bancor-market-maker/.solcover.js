module.exports = {
  norpc: true,
  copyPackages: [
    '@aragon/os',
    '@aragon/apps-token-manager',
    '@aragon/apps-agent',
    '@aragon/apps-vault',
    '@ablack/fundraising-interface-core',
    '@ablack/fundraising-formula-bancor',
  ],
  skipFiles: ['test'],
}
