module.exports = {
  norpc: true,
  copyPackages: [
    '@aragon/os',
    '@aragon/apps-shared-migrations',
    '@aragon/test-helpers',
    '@aragon/apps-vault',
    '@ablack/fundraising-shared-interfaces',
    '@ablack/fundraising-test-helpers',
  ],
  skipFiles: [
    'test',
    '@aragon/os',
    '@aragon/apps-shared-migrations',
    '@aragon/test-helpers',
    '@aragon/apps-vault',
    '@ablack/fundraising-shared-interfaces',
    '@ablack/fundraising-test-helpers',
  ],
}
