# Aragon 0.7 Fundraising template

## Description

The fundraising kit relies on two category of actors: the project managers and the investors:

- The project managers are represented through a custom `PRO` token and a dedicated voting app set to be used as a multisig instance.
- The investors are represented through a `BON` bonded-token they can buy through the `MarketMaker` and a voting app set to be used a democracy instance.

## Permissions

### Kernel and ACL


| App    | Permission         | Grantee      | Manager      |
| ------ | ------------------ | ------------ | ------------ |
| Kernel | APP_MANAGER        | Voting [BON] | Voting [BON] |
| ACL    | CREATE_PERMISSIONS | Voting [BON] | Voting [BON] |

### Base organization

| App                 | Permission      | Grantee             | Manager      |
| ------------------- | --------------- | ------------------- | ------------ |
| Token Manager [PRO] | ASSIGN          | Voting [PRO]        | Voting [PRO] |
| Token Manager [PRO] | REVOKE_VESTINGS | Voting [PRO]        | Voting [PRO] |
| Voting [PRO]        | CREATE_VOTES    | Token Manager [PRO] | Voting [PRO] |
| Voting [PRO]        | MODIFY_QUORUM   | Voting [PRO]        | Voting [PRO] |
| Voting [PRO]        | MODIFY_SUPPORT  | Voting [PRO]        | Voting [PRO] |
| Voting [BON]        | CREATE_VOTES    | Token Manager [BON] | Voting [BON] |
| Voting [BON]        | MODIFY_QUORUM   | Voting [BON]        | Voting [BON] |

### Vaut and Finance

Handle beneficiary's funds management

| App     | Permission       | Grantee      | Manager      |
| ------- | ---------------- | ------------ | ------------ |
| Vault   | TRANSFER         | Finance      | Voting [PRO] |
| Finance | CREATE_PAYMENTS  | Voting [PRO] | Voting [PRO] |
| Finance | EXECUTE_PAYMENTS | Voting [PRO] | Voting [PRO] |
| Finance | MANAGE_PAYMENTS  | Voting [PRO] | Voting [PRO] |


### TokenManager [BON]
_Handle bonds minting and burning_

| App                 | Permission | Grantee     | Manager      |
| ------------------- | ---------- | ----------- | ------------ |
| Token Manager [BON] | MINT       | MarketMaker | Voting [BON] |
| Token Manager [BON] | BURN       | MarketMaker | Voting [BON] |

### MarketMaker
_Handle buy and sell orders_

| App         | Permission              | Grantee    | Manager      |
| ----------- | ----------------------- | ---------- | ------------ |
| MarketMaker | ADD_COLLATERAL_TOKEN    | Controller | Voting [BON] |
| MarketMaker | REMOVE_COLLATERAL_TOKEN | Controller | Voting [BON] |
| MarketMaker | UPDATE_COLLATERAL_TOKEN | Controller | Voting [BON] |
| MarketMaker | UPDATE_BENEFICIARY      | Controller | Voting [BON] |
| MarketMaker | UPDATE_FORMULA          | NULL       | NULL         |
| MarketMaker | UPDATE_FEES             | Controller | Voting [BON] |
| MarketMaker | OPEN_BUY_ORDER          | Controller | Voting [BON] |
| MarketMaker | OPEN_SELL_ORDER         | Controller | Voting [BON] |


### Tap

Handle transfer of funds from the reserve to the beneficiary

| App | Permission                      | Grantee    | Manager      |
| --- | ------------------------------- | ---------- | ------------ |
| Tap | UPDATE_CONTROLLER               | NULL       | NULL         |
| Tap | UPDATE_RESERVE                  | NULL       | NULL         |
| Tap | UPDATE_BENEFICIARY              | Controller | Voting [BON] |
| Tap | UPDATE_MAXIMUM_TAP_INCREASE_PCT | Controller | Voting [BON] |
| Tap | ADD_TAPPED_TOKEN                | Controller | Voting [BON] |
| Tap | REMOVE_TAPPED_TOKEN             | NULL       | NULL         |
| Tap | UPDATE_TAPPED_TOKEN             | Controller | Voting [BON] |
| Tap | WITHDRAW                        | Controller | Voting [PRO] |


### Pool

Handle reserve funds

| App  | Permission             | Grantee         | Manager      |
| ---- | ---------------------- | --------------- | ------------ |
| Pool | SAFE_EXECUTE           | Voting [BON]    | Voting [BON] |
| Pool | ADD_PROTECTED_TOKEN    | Controller      | Voting [BON] |
| Pool | REMOVE_PROTECTED_TOKEN | NULL            | NULL         |
| Pool | TRANSFER               | Tap, Controller | Voting [BON] |

### Controller

API contract forwarding transactions to relevant contracts

| App        | Permission                  | Grantee      | Manager      |
| ---------- | --------------------------- | ------------ | ------------ |
| Controller | UPDATE_BENEFICIARY          | Voting [PRO] | Voting [PRO] |
| Controller | UPDATE_FEES                 | Voting [BON] | Voting [BON] |
| Controller | ADD_COLLATERAL_TOKEN        | Voting [BON] | Voting [BON] |
| Controller | REMOVE_COLLATERAL_TOKEN     | Voting [BON] | Voting [BON] |
| Controller | UPDATE_COLLATERAL_TOKEN     | Voting [BON] | Voting [BON] |
| Controller | UPDATE_TOKEN_TAP            | Voting [BON] | Voting [BON] |
| Controller | UPDATE_MONTHLY_TAP_INCREASE | Voting [BON] | Voting [BON] |
| Controller | CREATE_BUY_ORDER            | Any          | Voting [BON] |
| Controller | CREATE_SELL_ORDER           | Any          | Voting [BON] |
| Controller | WITHDRAW                    | Voting [PRO] | Voting [PRO] |

## Gas usage

Tested running `GAS_REPORTER=true truffle test --network devnet test/gas.js`

- Create the Kit: ??
- Create new token: ??
- Deploy new instance: ??
