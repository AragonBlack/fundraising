# Workflow

## Pre-requisites

- Node (latest LTS version), with the /bin folder on your $PATH
- aragonCLI
- aragon ipfs

## Development

Make sure you have cloned the fundraising repo (this repo) and also cloned the [Aragon client](https://github.com/aragon/aragon) repo.
```
git clone https://github.com/aragon/aragon.git
```
```
git clone https://github.com/AragonBlack/fundraising.git
```

In two separate terminal processes do the following:

Start the devchain.
```
npx aragon devchain
```
Start ipfs.
```
npx aragon ipfs
```


Then go to the src folder in the aragon client project and change the `environment.js` file to the following: https://gist.github.com/xseignard/e1952e53e62faa52b4f625344f5fba07

Start a third terminal process and install all dependencies by running: `npm install`

We now need to start the Aragon client by running:
```
env REACT_APP_ASSET_BRIDGE=fundraising npm run start:local
```

Start a fourth terminal process and go to your fundraising project and do `npm install`. Then run the following commands after each other only once:
```
npm run bootstrap
```
```
npm run publish
```

We can then `cd template/multisig` and `deploy:dao:rpc` to create a DAO. You'll get an address to a DAO which you need to remember since we need it soon.

Finally we can `cd ../../apps/aragon-fundraising/app` and run `npm start` to start our fundraising frontend. By now you should have four running terminal processes.

You can then go to `http://localhost:3000/#/DAO_ADDRESS` and replace `DAO_ADDRESS` with the DAO address that you recently saved. This should open up your DAO and you'll be able to go to the fundraising app and have the frontend change as soon as you make a change in your code.

## Deployment
TODO
