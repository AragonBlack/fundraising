# Aragon 0.8 Fundraising Multisig Template

## Description

The `fundraising-multisig` template relies on two category of actors: the board and the share holders.

The board are the ones being funded by the fundraising. They are represented through a custom `BOARD` token and a dedicated voting app set to be used as a multisig.

The share holders are the one contributing to the fundraising. They are represented through a `SHARE` bonded-token they can buy through the `MarketMaker` and a voting app.

## Permissions

### DAO

| App    | Permission         | Grantee        | Manager        |
| ------ | ------------------ | -------------- | -------------- |
| Kernel | APP_MANAGER        | Voting [SHARE] | Voting [SHARE] |
| ACL    | CREATE_PERMISSIONS | Voting [SHARE] | Voting [SHARE] |

### Board

#### TokenManager
_Represents board's membership_

| App                   | Permission | Grantee        | Manager        |
| --------------------- | ---------- | -------------- | -------------- |
| Token Manager [BOARD] | MINT       | Voting [BOARD] | Voting [BOARD] |
| Token Manager [BOARD] | BURN       | Voting [BOARD] | Voting [BOARD] |


#### Voting
_Enforces board's decisions_

| App            | Permission     | Grantee               | Manager        |
| -------------- | -------------- | --------------------- | -------------- |
| Voting [BOARD] | CREATE_VOTES   | Token Manager [BOARD] | Voting [BOARD] |
| Voting [BOARD] | MODIFY_QUORUM  | Voting [BOARD]        | Voting [BOARD] |
| Voting [BOARD] | MODIFY_SUPPORT | Voting [BOARD]        | Voting [BOARD] |

#### Vaut and Finance
_Handle board's funds_

| App     | Permission       | Grantee        | Manager        |
| ------- | ---------------- | -------------- | -------------- |
| Vault   | TRANSFER         | Finance        | Voting [BOARD] |
| Finance | CREATE_PAYMENTS  | Voting [BOARD] | Voting [BOARD] |
| Finance | EXECUTE_PAYMENTS | Voting [BOARD] | Voting [BOARD] |
| Finance | MANAGE_PAYMENTS  | Voting [BOARD] | Voting [BOARD] |

### Share Holders

#### TokenManager
_Handle shares / bonds minting and burning_

| App                   | Permission | Grantee     | Manager        |
| --------------------- | ---------- | ----------- | -------------- |
| Token Manager [SHARE] | MINT       | MarketMaker | Voting [SHARE] |
| Token Manager [SHARE] | BURN       | MarketMaker | Voting [SHARE] |

#### Voting
_Enforces share holders decisions_


| App            | Permission     | Grantee               | Manager        |
| -------------- | -------------- | --------------------- | -------------- |
| Voting [SHARE] | CREATE_VOTES   | Token Manager [BOARD] | Voting [SHARE] |
| Voting [SHARE] | MODIFY_QUORUM  | Voting [SHARE]        | Voting [SHARE] |
| Voting [SHARE] | MODIFY_SUPPORT | Voting [SHARE]        | Voting [SHARE] |


### Fundraising apps

#### Agent / Reserve
_Handle market maker funds_

| App  | Permission             | Grantee          | Manager        |
| ---- | ---------------------- | ---------------- | -------------- |
| Pool | SAFE_EXECUTE           | Voting [SHARE]   | Voting [SHARE] |
| Pool | ADD_PROTECTED_TOKEN    | Controller       | Voting [SHARE] |
| Pool | REMOVE_PROTECTED_TOKEN | NULL             | NULL           |
| Pool | EXECUTE                | NULL             | NULL           |
| Pool | DESIGNATE_SIGNER       | NULL             | NULL           |
| Pool | ADD_PRESIGNED_HASH     | NULL             | NULL           |
| Pool | RUN_SCRIPT             | NULL             | NULL           |
| Pool | TRANSFER               | Tap, MarketMaker | Voting [SHARE] |

#### MarketMaker
_Handle buy and sell orders_

| App         | Permission              | Grantee    | Manager        |
| ----------- | ----------------------- | ---------- | -------------- |
| MarketMaker | ADD_COLLATERAL_TOKEN    | Controller | Voting [SHARE] |
| MarketMaker | REMOVE_COLLATERAL_TOKEN | Controller | Voting [SHARE] |
| MarketMaker | UPDATE_COLLATERAL_TOKEN | Controller | Voting [SHARE] |
| MarketMaker | UPDATE_BENEFICIARY      | Controller | Voting [SHARE] |
| MarketMaker | UPDATE_FORMULA          | NULL       | NULL           |
| MarketMaker | UPDATE_FEES             | Controller | Voting [SHARE] |
| MarketMaker | OPEN_BUY_ORDER          | Controller | Voting [SHARE] |
| MarketMaker | OPEN_SELL_ORDER         | Controller | Voting [SHARE] |

#### Tap
_Control the flow of funds from reserve to board_

| App | Permission                      | Grantee    | Manager        |
| --- | ------------------------------- | ---------- | -------------- |
| Tap | UPDATE_CONTROLLER               | NULL       | NULL           |
| Tap | UPDATE_RESERVE                  | NULL       | NULL           |
| Tap | UPDATE_BENEFICIARY              | Controller | Voting [SHARE] |
| Tap | UPDATE_MAXIMUM_TAP_INCREASE_PCT | Controller | Voting [SHARE] |
| Tap | ADD_TAPPED_TOKEN                | Controller | Voting [SHARE] |
| Tap | REMOVE_TAPPED_TOKEN             | NULL       | NULL           |
| Tap | UPDATE_TAPPED_TOKEN             | Controller | Voting [SHARE] |
| Tap | WITHDRAW                        | Controller | Voting [BOARD] |

#### Controller
_API contract forwarding transactions to relevant contracts_

| App        | Permission                      | Grantee        | Manager        |
| ---------- | ------------------------------- | -------------- | -------------- |
| Controller | UPDATE_BENEFICIARY              | Voting [BOARD] | Voting [BOARD] |
| Controller | WITHDRAW                        | Voting [BOARD] | Voting [BOARD] |
| Controller | UPDATE_FEES                     | Voting [SHARE] | Voting [SHARE] |
| Controller | UPDATE_MAXIMUM_TAP_INCREASE_PCT | Voting [SHARE] | Voting [SHARE] |
| Controller | ADD_COLLATERAL_TOKEN            | Voting [SHARE] | Voting [SHARE] |
| Controller | REMOVE_COLLATERAL_TOKEN         | Voting [SHARE] | Voting [SHARE] |
| Controller | UPDATE_COLLATERAL_TOKEN         | Voting [SHARE] | Voting [SHARE] |
| Controller | UPDATE_TOKEN_TAP                | Voting [SHARE] | Voting [SHARE] |
| Controller | OPEN_BUY_ORDER                  | Any            | Voting [SHARE] |
| Controller | OPEN_SELL_ORDER                 | Any            | Voting [SHARE] |
