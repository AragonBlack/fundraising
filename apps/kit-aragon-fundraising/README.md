# Aragon 0.7 Fundraising template

## Description

The fundraising kit relies on two category of actors: the project managers and the investors:

- The project managers are represented through a custom `PRO` token and a dedicated voting app set to be used as a multisig instance.
- The investors are represented through a `BON` bonded-token they can buy through the `MarketMaker` and a voting app set to be used a democracy instance.

## Permissions

| App                 | Permission                  | Grantee             | Manager      |
| ------------------- | --------------------------- | ------------------- | ------------ |
| Kernel              | APP_MANAGER                 | Voting (BON)        | Voting (BON) |
| ACL                 | CREATE_PERMISSIONS          | Voting (BON)        | Voting (BON) |
| Token Manager (PRO) | ASSIGN                      | Voting (PRO)        | Voting (PRO) |
| Token Manager (PRO) | REVOKE_VESTINGS             | Voting (PRO)        | Voting (PRO) |
| Voting (PRO)        | CREATE_VOTES                | Token Manager (PRO) | Voting (PRO) |
| Voting (PRO)        | MODIFY_QUORUM               | Voting (PRO)        | Voting (PRO) |
| Voting (PRO)        | MODIFY_SUPPORT              | Voting (PRO)        | Voting (PRO) |
| Vault               | TRANSFER                    | Finance             | Voting (PRO) |
| Finance             | CREATE_PAYMENTS             | Voting (PRO)        | Voting (PRO) |
| Finance             | EXECUTE_PAYMENTS            | Voting (PRO)        | Voting (PRO) |
| Finance             | MANAGE_PAYMENTS             | Voting (PRO)        | Voting (PRO) |
| Token Manager (BON) | MINT                        | MarketMaker         | Voting (BON) |
| Token Manager (BON) | BURN                        | MarketMaker         | Voting (BON) |
| Voting (BON)        | CREATE_VOTES                | Token Manager (BON) | Voting (BON) |
| Voting (BON)        | MODIFY_QUORUM               | Voting (BON)        | Voting (BON) |
| Tap                 | UPDATE_BENEFICIARY          | Voting (PRO)        | Voting (PRO) |
| Tap                 | UPDATE_MONTHLY_TAP_INCREASE | Controller          | Voting (BON) |
| Tap                 | ADD_TOKEN_TAP               | Controller          | Voting (BON) |
| Tap                 | UPDATE_TOKEN_TAP            | Controller          | Voting (BON) |
| Tap                 | WITHDRAW                    | Controller          | Voting (PRO) |
| Pool                | SAFE_EXECUTE                | Voting (BON)        | Voting (BON) |
| Pool                | ADD_COLLATERAL_TOKEN        | Controller          | Voting (BON) |
| Pool                | TRANSFER                    | Tap, Controller     | Voting (BON) |
| MarketMaket         | ADD_COLLATERAL_TOKEN        | Controller          | Voting (BON) |
| MarketMaket         | UPDATE_COLLATERAL_TOKEN     | Controller          | Voting (BON) |
| MarketMaket         | UPDATE_FEE                  | Controller          | Voting (BON) |
| MarketMaket         | CREATE_BUY_ORDER            | Controller          | Voting (BON) |
| MarketMaket         | CREATE_SELL_ORDER           | Controller          | Voting (BON) |
| Controller          | ADD_COLLATERAL_TOKEN        | Voting (BON)        | Voting (BON) |
| Controller          | UPDATE_TOKEN_TAP            | Voting (BON)        | Voting (BON) |
| Controller          | UPDATE_MONTHLY_TAP_INCREASE | Voting (BON)        | Voting (BON) |
| Controller          | CREATE_BUY_ORDER            | Any                 | Voting (BON) |
| Controller          | CREATE_SELL_ORDER           | Any                 | Voting (BON) |
| Controller          | WITHDRAW                    | Voting (PRO)        | Voting (PRO) |

## Gas usage

Tested running `GAS_REPORTER=true truffle test --network devnet test/gas.js`

- Create the Kit: ??
- Create new token: ??
- Deploy new instance: ??
