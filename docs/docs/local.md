---
id: local
title: Setup local environment
sidebar_label: Setup local environment
---

# Setup a local dev environment

## Prerequisites
- Global npm packages
```
npm i -g @aragon/cli
```
- Clone fundraising repo
```
git clone git@github.com:AragonBlack/fundraising.git
cd fundraising
```
- Bootstrap projects with lerna (mostly to run `npm install`)
```
npm run bootstrap
```

## Publish aragon apps
Publish aragon apps with lerna
```
npm run publish
```

## Publish and deploy `kit-aragon-fundraising`
- Publish the kit
```
cd apps/kit-aragon-fundraising
npm run publish:rpc
```
- Deploy DAO
```
npm run deploy:dao:rpc
```

⚠️ **Note the address of the DAO** (referred as <DAO_ADDRESS> later)

## Starting the local devchain
```
aragon devchain
```

## Starting local IPFS
```
aragon ipfs
```

## Starting local aragon frontend
- Clone
```
git clone git@github.com:aragon/aragon.git
```
- Install deps
```
npm i
```
- Copy aragon assets
```
npm run ui-assets
```
- Start it locally
```
npm run start:local
```

## Publish fundraising app
If no changes happens on the smart contracts (e.g. only frontend changes), it should be considered as a minor change.

To publish fundraising, run the following
```
cd apps/controller-aragon-fundraising
npm run publish:minor:devchain
```

You can now browse `http://localhost:3000/#/<DAO_ADDRESS>`
