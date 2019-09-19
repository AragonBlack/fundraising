# Aragon 0.8 Fundraising Multisig Template

## Description
Aragon Fundraising Multisig Template differenciate two set actors: the **board** and the **shareholders**.

### Board

The board are the ones being funded by the fundraising campaign. They are represented through a custom `BOARD` token and a dedicated voting app set to be used as a multisig. Their privileges are intentionnaly limited to protect shareholders. Thus, they only have the following rights.

#### Handling board members

The board decides on who is to be included / excluded from the board [through its `TokenManager`].

#### Opening presale

The board decides on when the presale [and thus the fundraising campaign] is to be open.

#### Handling fundraising proceeds

The board decides on what use is to be made of the fundraising proceeds which are periodically transferred to their discretionnary `Vault` / `Finance` app.

#### Opening votes

The board decides on when new votes should be open for shareholders to enforce decisions over the organization.


### Shareholders

The shareholders are the one contributing to the fundraising campaign. They are represented through a `SHARE` bonded-token [they can buy and redeem through the Aragon Fundraising interface] and a voting app. They hold most of the rights over the organization.

#### Handling system

Shareholders decide on which apps are to be installed, which apps are to to upgraded and how permissions are to be set.

#### Handling fundraising parameters

Shareholders decide on whether / how beneficiary, fees, collateralization settings and collaterals taps should be updated.

### Rationale

This architecture grants [most of] the governance rights to shareholders [to protect their investment]. There is thus a need to mitigate situations where a shareholder owning more than 50% of the shares would own the whole organization. This is why `SHARE` based votes [_i.e._ most of the organization decisions] can only be open and initiated by the board.


## Usage

### Prepare instance
> Deploy a DAO and install all board related apps

```
template.prepareInstance(boardTokenName, boardTokenSymbol, boardMembers, boardVotingsSettings, financePeriod)
```

- **boardTokenName** Name for the token used by the board
- **boardTokenSymbol** Symbol for the token used by the board
- **boardMembers** Array of board members addresses
- **boardVotingSettings:** Array of [supportRequired, minAcceptanceQuorum, voteDuration] to set up the board voting app [multisig]
- **financePeriod** Initial duration for accounting periods of the boards discretionnary vault [it can be set to zero in order to use the default of 30 days]

### Install share apps

```
template.installShareApps(id, shareTokenName, shareTokenSymbol, shareVotingsSettings)
```

- **id** Id for org, will assign [id].aragonid.eth
- **shareTokenName** Name for the token used by the shareholders [the bonded token]
- **shareTokenSymbol** Symbol for the token used by shareholders [the bonded token]
- **shareVotingSettings:** Array of [supportRequired, minAcceptanceQuorum, voteDuration] to set up the shareholders voting app [multisig]

### Install fundraising apps

```
template.installFundraisingApps(
    goal,
    period,
    exchangeRate,
    vestingCliffPeriod,
    vestingCompletePeriod,
    supplyOfferedPct,
    fundingForBeneficiaryPct,
    openDate,
    batchBlocks,
    maximumTapRateIncreasePct,
    maximumTapFloorDecreasePct
)
```

- **goal** The presale goal
- **period** The presale period
- **exchangeRate** The presale exchange rate
- **vestingCliffPeriod** The cliff period for vested shares purchased during presale
- **vestingCompletePeriod** The complete period for vested shares purchased during presale
- **supplyOfferedPct** The percentage of the initial token supply offered to presale's contributors
- **fundingForBeneficiaryPct** The percentage of the presale raised funds which are to be transferred to the board's discretionnary vault
- **openDate** The date upon which the presale will be open [if 0, the presale can be open manually later]
- **batchBlocks** The number of blocks trading batches will last
- **maximumTapRateIncreasePct** The maximum percentage tap rates can be increased at once
- **maximumTapRateIncreasePct** The maximum percentage tap floors can be decreased at once

### Finalize instance
> Set collateralization settings

```
template.finalizeInstance(virtualSupplies, virtualBalances, slippages, daiRate, daiFloor)
```

- **virtualSupplies** Array of [daiVirtualSupply, antVirtualSupply] to set up the market maker
- **virtualBalances** Array of [daiVirtualBalance, antVirtualBalance] to set up the market maker
- **slippages** Array of [daiMaxSlippage, antMaxSlippage] to set up the maximum per-batch price slippage in the market maker
- **daiRate** The rate at which DAIs are to be tapped
- **daiFloor** The floor above which the DAI reserve pool is to be kept

## Permissions

### System
_Handle apps and permissions_

| App               | Permission            | Grantee          | Manager          |
| ----------------- | --------------------- | ---------------- | ---------------- |
| Kernel            | APP_MANAGER           | Voting `[SHARE]` | Voting `[SHARE]` |
| ACL               | CREATE_PERMISSIONS    | Voting `[SHARE]` | Voting `[SHARE]` |
| EVMScriptRegistry | REGISTRY_MANAGER      | Voting `[SHARE]` | Voting `[SHARE]` |
| EVMScriptRegistry | REGISTRY_ADD_EXECUTOR | Voting `[SHARE]` | Voting `[SHARE]` |


### Board

#### TokenManager
_Represents board's membership_

| App                     | Permission      | Grantee          | Manager          |
| ----------------------- | --------------- | ---------------- | ---------------- |
| Token Manager `[BOARD]` | MINT            | Voting `[BOARD]` | Voting `[SHARE]` |
| Token Manager `[BOARD]` | BURN            | Voting `[BOARD]` | Voting `[SHARE]` |
| Token Manager `[BOARD]` | ISSUE           | NULL             | NULL             |
| Token Manager `[BOARD]` | ASSIGN          | NULL             | NULL             |
| Token Manager `[BOARD]` | REVOKE_VESTINGS | NULL             | NULL             |

#### Voting
_Enforces board's decisions_

| App              | Permission     | Grantee                 | Manager          |
| ---------------- | -------------- | ----------------------- | ---------------- |
| Voting `[BOARD]` | CREATE_VOTES   | Token Manager `[BOARD]` | Voting `[SHARE]` |
| Voting `[BOARD]` | MODIFY_QUORUM  | Voting `[BOARD]`        | Voting `[SHARE]` |
| Voting `[BOARD]` | MODIFY_SUPPORT | Voting `[BOARD]`        | Voting `[SHARE]` |

#### Vault and Finance
_Handle board's funds_

| App     | Permission          | Grantee          | Manager          |
| ------- | ------------------- | ---------------- | ---------------- |
| Vault   | TRANSFER            | Finance          | Voting `[SHARE]` |
| Finance | CREATE_PAYMENTS     | Voting `[BOARD]` | Voting `[SHARE]` |
| Finance | EXECUTE_PAYMENTS    | Voting `[BOARD]` | Voting `[SHARE]` |
| Finance | MANAGE_PAYMENTS     | Voting `[BOARD]` | Voting `[SHARE]` |
| Finance | CHANGE_PERIOD       | NULL             | NULL             |
| Finance | CHANGE_BUDGETS_ROLE | NULL             | NULL             |

### Share Holders

#### TokenManager
_Handle shares / bonds minting and burning_

| App                     | Permission      | Grantee              | Manager          |
| ----------------------- | --------------- | -------------------- | ---------------- |
| Token Manager `[SHARE]` | MINT            | MarketMaker          | Voting `[SHARE]` |
| Token Manager `[SHARE]` | BURN            | MarketMaker, Presale | Voting `[SHARE]` |
| Token Manager `[SHARE]` | ISSUE           | Presale              | Voting `[SHARE]` |
| Token Manager `[SHARE]` | ASSIGN          | Presale              | Voting `[SHARE]` |
| Token Manager `[SHARE]` | REVOKE_VESTINGS | Presale              | Voting `[SHARE]` |


#### Voting
_Enforces share holders decisions_


| App              | Permission     | Grantee                 | Manager          |
| ---------------- | -------------- | ----------------------- | ---------------- |
| Voting `[SHARE]` | CREATE_VOTES   | Token Manager `[BOARD]` | Voting `[SHARE]` |
| Voting `[SHARE]` | MODIFY_QUORUM  | Voting `[SHARE]`        | Voting `[SHARE]` |
| Voting `[SHARE]` | MODIFY_SUPPORT | Voting `[SHARE]`        | Voting `[SHARE]` |


### Fundraising apps

#### Agent / Reserve
_Handle market maker funds_

| App  | Permission             | Grantee          | Manager          |
| ---- | ---------------------- | ---------------- | ---------------- |
| Pool | SAFE_EXECUTE           | Voting `[SHARE]` | Voting `[SHARE]` |
| Pool | ADD_PROTECTED_TOKEN    | Controller       | Voting `[SHARE]` |
| Pool | REMOVE_PROTECTED_TOKEN | NULL             | NULL             |
| Pool | EXECUTE                | NULL             | NULL             |
| Pool | DESIGNATE_SIGNER       | NULL             | NULL             |
| Pool | ADD_PRESIGNED_HASH     | NULL             | NULL             |
| Pool | RUN_SCRIPT             | NULL             | NULL             |
| Pool | TRANSFER               | Tap, MarketMaker | Voting `[SHARE]` |


#### Presale
_Handle preliminary sale_

| App     | Permission | Grantee    | Manager          |
| ------- | ---------- | ---------- | ---------------- |
| Presale | OPEN       | Controller | Voting `[SHARE]` |
| Presale | CONTRIBUTE | Controller | Voting `[SHARE]` |


#### MarketMaker
_Handle buy and sell orders_

| App         | Permission              | Grantee    | Manager          |
| ----------- | ----------------------- | ---------- | ---------------- |
| MarketMaker | OPEN                    | Controller | Voting `[SHARE]` |
| MarketMaker | UPDATE_FORMULA          | NULL       | NULL             |
| MarketMaker | UPDATE_BENEFICIARY      | Controller | Voting `[SHARE]` |
| MarketMaker | UPDATE_FEES             | Controller | Voting `[SHARE]` |
| MarketMaker | ADD_COLLATERAL_TOKEN    | Controller | Voting `[SHARE]` |
| MarketMaker | REMOVE_COLLATERAL_TOKEN | Controller | Voting `[SHARE]` |
| MarketMaker | UPDATE_COLLATERAL_TOKEN | Controller | Voting `[SHARE]` |
| MarketMaker | OPEN_BUY_ORDER          | Controller | Voting `[SHARE]` |
| MarketMaker | OPEN_SELL_ORDER         | Controller | Voting `[SHARE]` |

#### Tap
_Control the flow of funds from reserve to board_

| App | Permission                            | Grantee    | Manager          |
| --- | ------------------------------------- | ---------- | ---------------- |
| Tap | UPDATE_CONTROLLER                     | NULL       | NULL             |
| Tap | UPDATE_RESERVE                        | NULL       | NULL             |
| Tap | UPDATE_BENEFICIARY                    | Controller | Voting `[SHARE]` |
| Tap | UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT  | Controller | Voting `[SHARE]` |
| Tap | UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT | Controller | Voting `[SHARE]` |
| Tap | ADD_TAPPED_TOKEN                      | Controller | Voting `[SHARE]` |
| Tap | REMOVE_TAPPED_TOKEN                   | NULL       | NULL             |
| Tap | UPDATE_TAPPED_TOKEN                   | Controller | Voting `[SHARE]` |
| Tap | RESET_TAPPED_TOKEN                    | Controller | Voting `[SHARE]` |
| Tap | WITHDRAW                              | Controller | Voting `[SHARE]` |

#### Controller
_API contract forwarding transactions to relevant contracts_

| App        | Permission                            | Grantee          | Manager          |
| ---------- | ------------------------------------- | ---------------- | ---------------- |
| Controller | UPDATE_BENEFICIARY                    | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE_FEES                           | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | ADD_COLLATERAL_TOKEN                  | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | REMOVE_COLLATERAL_TOKEN               | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE_COLLATERAL_TOKEN               | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT  | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | ADD_TOKEN_TAP                         | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE_TOKEN_TAP                      | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | OPEN_PRESALE                          | Voting `[BOARD]` | Voting `[SHARE]` |
| Controller | OPEN_TRADING                          | Presale          | Voting `[SHARE]` |
| Controller | CONTRIBUTE                            | Any              | Voting `[SHARE]` |
| Controller | OPEN_BUY_ORDER                        | Any              | Voting `[SHARE]` |
| Controller | OPEN_SELL_ORDER                       | Any              | Voting `[SHARE]` |
| Controller | WITHDRAW                              | Any              | Voting `[SHARE]` |
