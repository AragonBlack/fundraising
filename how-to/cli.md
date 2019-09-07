---
description: Installing and Deploying a Fundraising DAO
---

# CLI



#### Install

**Aragon CLI**

```text
npm install -g @aragon/cli
```

**Aragon Client**

```text
git clone https://github.com/aragon/aragon.git

cd aragon

npm install
```

**Aragon Fundraising Monorepo**

```text
git clone https://github.com/AragonBlack/fundraising.git

cd fundraising

npm install
```

#### Run

**Aragon Devchain**

> `From a new terminal window`

```text
aragon devchain
```

**Aragon IPFS Node**

> `From a new terminal window`

```text
aragon ipfs start
```

**Aragon Client**

> `From the Aragon Client directory`

```text
npm run start:local
```

**Publish Fundraising Apps**

> `From the Aragon Fundraising Monorepo directory`

```text
npm run publish
```

**Deploy a test DAO**

> `From the Aragon Fundraising Monorepo directory`

```text
npm run deploy:dao:rpc
```

#### Browse

> `Copy the newly deployed DAO address [0x...] and head your browser to`

```text
http://localhost:3000/#/0x...
```

