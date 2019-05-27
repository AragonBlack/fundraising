# Aragon 0.7 Multisig template

See [Beta templates description](https://github.com/aragon/dao-kits/blob/master/kits/beta-base/readme.md).

## Usage

```
multisig.newInstance(name, signers, neededSignatures)
```

- `name`: Name for org, will assign `[name].aragonid.eth` (check capitalization)
- `signers`: Array of addresses that are the multisig signatories
  (they will be issued 1 token)
- `neededSignatures`: Number of signers that need to sign to execute an action
  (parametrizing the Voting app under the hood)

## Deploying templates

After deploying ENS, APM and AragonID, just run:

```
npm run deploy:rinkeby
```

The network details will be automatically selected by the `arapp.json`'s environments.

## Permissions

| App                 | Permission                  | Grantee             | Manager      |
| ------------------- | --------------------------- | ------------------- | ------------ |
| Voting (PRO)        | CREATE_VOTES                | Token Manager (PRO) | Voting (PRO) |
| Voting (PRO)        | MODIFY_QUORUM               | Voting (PRO)        | Voting (PRO) |
| Voting (PRO)        | MODIFY_SUPPORT              | Voting (PRO)        | Voting (PRO) |
| Voting (BON)        | CREATE_VOTES                | Token Manager (BON) | Voting (BON) |
| Voting (BON)        | MODIFY_QUORUM               | Voting (BON)        | Voting (BON) |
| Voting (BON)        | MODIFY_SUPPORT              | Voting (BON)        | Voting (BON) |
| Vault               | TRANSFER                    | Finance             | Voting (PRO) |
| Finance             | CREATE_PAYMENTS             | Voting (PRO)        | Voting (PRO) |
| Finance             | EXECUTE_PAYMENTS            | Voting (PRO)        | Voting (PRO) |
| Finance             | DISABLE_PAYMENTS            | Voting (PRO)        | Voting (PRO) |
| Token Manager (PRO) | ASSIGN                      | Voting (PRO)        | Voting (PRO) |
| Token Manager (PRO) | REVOKE_VESTINGS             | Voting (PRO)        | Voting (PRO) |
| Token Manager (BON) | MINT                        | MarketMaker         | Voting (BON) |
| Token Manager (BON) | BURN                        | MarketMaker         | Voting (BON) |
| Kernel              | APP_MANAGER                 | Voting (PRO)        | Voting (PRO) |
| ACL                 | CREATE_PERMISSIONS          | Voting (PRO)        | Voting (PRO) |
| EVMScriptRegistry   | REGISTRY_ADD_EXECUTOR       | Voting (PRO)        | Voting (PRO) |
| EVMScriptRegistry   | REGISTRY_MANAGER            | Voting (PRO)        | Voting (PRO) |
| Tap                 | UPDATE_BENEFICIARY          | Voting (PRO)        | Voting (PRO) |
| Tap                 | UPDATE_MONTHLY_TAP_INCREASE | Controller          | Voting (BON) |
| Tap                 | ADD_TOKEN_TAP               | Controller          | Voting (BON) |
| Tap                 | UPDATE_TOKEN_TAP            | Controller          | Voting (BON) |
| Tap                 | WITHDRAW                    | Controller          | Voting (BON) |
| Pool                | SAFE_EXECUTE                | Voting (BON)        | Voting (BON) |
| Pool                | ADD_COLLATERAL_TOKEN        | Controller          | Voting (BON) |
| Pool                | TRANSFER                    | Tap, Controller     | Voting (BON) |
| MarketMaket         | ADD_COLLATERAL_TOKEN        | Controller          | Voting (BON) |
| MarketMaket         | UPDATE_COLLATERAL_TOKEN     | Controller          | Voting (BON) |
| MarketMaket         | UPDATE_FEE                  | Controller          | Voting (BON) |
| MarketMaket         | CREATE_BUY_ORDER            | Any                 | Voting (BON) |
| MarketMaket         | CREATE_SELL_ORDER           | Any                 | Voting (BON) |
| Controller          | ADD_COLLATERAL_TOKEN        | Voting (BON)        | Voting (BON) |
| Controller          | UPDATE_TOKEN_TAP            | Voting (BON)        | Voting (BON) |
| Controller          | UPDATE_MONTHLY_TAP_INCREASE | Voting (BON)        | Voting (BON) |
| Controller          | CREATE_BUY_ORDER            | Any                 | Voting (BON) |
| Controller          | CREATE_SELL_ORDER           | Any                 | Voting (BON) |
| Controller          | WITHDRAW                    | Voting (PRO)        | Voting (PRO) |

bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
bytes32 public constant UPDATE_MONTHLY_TAP_INCREASE_ROLE = keccak256("UPDATE_MONTHLY_TAP_INCREASE_ROLE");
bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");
bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE = keccak256("ADD_COLLATERAL_TOKEN_ROLE");
bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE = keccak256("UPDATE_COLLATERAL_TOKEN_ROLE");
bytes32 public constant UPDATE_FEE_ROLE = keccak256("UPDATE_FEE_ROLE");
bytes32 public constant UPDATE_GAS_COSTS_ROLE = keccak256("UPDATE_GAS_COSTS_ROLE");
bytes32 public constant CREATE_BUY_ORDER_ROLE = keccak256("CREATE_BUY_ORDER_ROLE");
bytes32 public constant CREATE_SELL_ORDER_ROLE = keccak256("CREATE_SELL_ORDER_ROLE");

"roles": [
{
"name": "Execute safe actions",
"id": "SAFE_EXECUTE_ROLE",
"params": []
},
{
"name": "Add collateral tokens to safeguard",
"id": "ADD_COLLATERAL_TOKEN_ROLE",
"params": []
},
{
"name": "Remove collateral tokens to safeguard",
"id": "REMOVE_COLLATERAL_TOKEN_ROLE",
"params": []
}

bytes32 public constant UPDATE_MONTHLY_TAP_INCREASE_ROLE = keccak256("UPDATE_MONTHLY_TAP_INCREASE_ROLE");
bytes32 public constant ADD_TOKEN_TAP_ROLE = keccak256("ADD_TOKEN_TAP_ROLE");
bytes32 public constant UPDATE_TOKEN_TAP_ROLE = keccak256("UPDATE_TOKEN_TAP_ROLE");
bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

## Gas usage

Tested running `GAS_REPORTER=true truffle test --network devnet test/gas.js`

- Create the Kit: ??
- Create new token: ??
- Deploy new instance: ??
