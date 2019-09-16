# Governance

The flexibility of aragonOS allows fundraising-enabled organizations to endorse a wide variety of governance structures: from a personal DAO where an individual manages a continuously funded organization supported by patrons \[similar to patreon\], to a community project where token holders are expected to actively participate in key governance decisions. Though, to streamline the use of Aragon Fundraising, we implemented a default governance template.

## Groups

Aragon Fundraising default governance template identifies two set actors: the board and the share holders.

The board token holders are the ones being funded by the fundraising campaign. They are represented through a custom `BOARD` token and a dedicated voting app set to be used as a multisig. 

The share holders are the one contributing to the fundraising campaign. They are represented through a `SHARE` bonded-token \[that can be bought and redeemed through the Aragon Fundraising interface\] and a voting app.

## Permissions

### DAO

{% hint style="info" %}
_Handles generic organization permissions_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Kernel | APP\_MANAGER | Voting `[SHARE]` | Voting `[SHARE]` |
| ACL | CREATE\_PERMISSIONS | Voting `[SHARE]` | Voting `[SHARE]` |

### Board

#### **TokenManager**

{% hint style="info" %}
_Handles board membership_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Token Manager `[BOARD]` | MINT | Voting \[BOARD\] | Voting `[BOARD]` |
| Token Manager `[BOARD]` | BURN | Voting \[BOARD\] | Voting `[BOARD]` |

#### **Voting**

{% hint style="info" %}
_Handles and enforces board decisions_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Voting `[BOARD]` | CREATE\_VOTES | Token Manager `[BOARD]` | Voting `[BOARD]` |
| Voting `[BOARD]` | MODIFY\_QUORUM | Voting `[BOARD]` | Voting `[BOARD]` |
| Voting `[BOARD]` | MODIFY\_SUPPORT | Voting `[BOARD]` | Voting `[BOARD]` |

#### **Vaut and Finance**

{% hint style="info" %}
_Handle board funds_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Vault | TRANSFER | Finance | Voting `[BOARD]` |
| Finance | CREATE\_PAYMENTS | Voting `[BOARD]` | Voting `[BOARD]` |
| Finance | EXECUTE\_PAYMENTS | Voting `[BOARD]` | Voting `[BOARD]` |
| Finance | MANAGE\_PAYMENTS | Voting `[BOARD]` | Voting `[BOARD]` |

### Share Holders

#### **TokenManager**

{% hint style="info" %}
_Handles shares minting and burning \[and thus share holders membership\]_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Token Manager \[SHARE\] | MINT | MarketMaker | Voting `[SHARE]` |
| Token Manager \[SHARE\] | BURN | MarketMaker | Voting `[SHARE]` |

#### **Voting**

{% hint style="info" %}
_Handles and enforces share holders decisions_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Voting \[SHARE\] | CREATE\_VOTES | Token Manager `[BOARD]` | Voting `[SHARE]` |
| Voting \[SHARE\] | MODIFY\_QUORUM | Voting `[SHARE]` | Voting `[SHARE]` |
| Voting \[SHARE\] | MODIFY\_SUPPORT | Voting `[SHARE]` | Voting `[SHARE]` |

### Fundraising Apps

#### **Reserve \[Agent\]**

{% hint style="info" %}
_Handles reserve pool funds_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Agent | SAFE\_EXECUTE | Voting `[SHARE]` | Voting `[SHARE]` |
| Agent | ADD\_PROTECTED\_TOKEN | Controller | Voting `[SHARE]` |
| Agent | REMOVE\_PROTECTED\_TOKEN | NULL | NULL |
| Agent | EXECUTE | NULL | NULL |
| Agent | DESIGNATE\_SIGNER | NULL | NULL |
| Agent | ADD\_PRESIGNED\_HASH | NULL | NULL |
| Agent | RUN\_SCRIPT | NULL | NULL |
| Agent | TRANSFER | Tap, MarketMaker | Voting `[SHARE]` |

#### **MarketMaker**

{% hint style="info" %}
_Handles buy and sell orders_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| MarketMaker | ADD\_COLLATERAL\_TOKEN | Controller | Voting `[SHARE]` |
| MarketMaker | REMOVE\_COLLATERAL\_TOKEN | Controller | Voting `[SHARE]` |
| MarketMaker | UPDATE\_COLLATERAL\_TOKEN | Controller | Voting `[SHARE]` |
| MarketMaker | UPDATE\_BENEFICIARY | Controller | Voting `[SHARE]` |
| MarketMaker | UPDATE\_FORMULA | NULL | NULL |
| MarketMaker | UPDATE\_FEES | Controller | Voting `[SHARE]` |
| MarketMaker | OPEN\_BUY\_ORDER | Controller | Voting `[SHARE]` |
| MarketMaker | OPEN\_SELL\_ORDER | Controller | Voting `[SHARE]` |

#### **Tap**

{% hint style="info" %}
_Controls the flow of funds from the reserve pool to the board's discretionary vault_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Tap | UPDATE\_CONTROLLER | NULL | NULL |
| Tap | UPDATE\_RESERVE | NULL | NULL |
| Tap | UPDATE\_BENEFICIARY | Controller | Voting `[SHARE]` |
| Tap | UPDATE\_MAXIMUM\_TAP\_INCREASE\_PCT | Controller | Voting `[SHARE]` |
| Tap | ADD\_TAPPED\_TOKEN | Controller | Voting `[SHARE]` |
| Tap | REMOVE\_TAPPED\_TOKEN | NULL | NULL |
| Tap | UPDATE\_TAPPED\_TOKEN | Controller | Voting `[SHARE]` |
| Tap | WITHDRAW | Controller | Voting `[BOARD]` |

#### **Controller \[Aragon Fundraising\]**

{% hint style="info" %}
_Forwards all transactions to the relevant modules \[API contract\]_
{% endhint %}

| Entity | Permission | Grantee | Manager |
| :--- | :--- | :--- | :--- |
| Controller | UPDATE\_BENEFICIARY | Voting `[BOARD]` | Voting `[BOARD]` |
| Controller | WITHDRAW | Voting `[BOARD]` | Voting `[BOARD]` |
| Controller | UPDATE\_FEES | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE\_MAXIMUM\_TAP\_INCREASE\_PCT | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | ADD\_COLLATERAL\_TOKEN | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | REMOVE\_COLLATERAL\_TOKEN | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE\_COLLATERAL\_TOKEN | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | UPDATE\_TOKEN\_TAP | Voting `[SHARE]` | Voting `[SHARE]` |
| Controller | OPEN\_BUY\_ORDER | Any | Voting `[SHARE]` |
| Controller | OPEN\_SELL\_ORDER | Any | Voting `[SHARE]` |

![Permissions Diagram](../.gitbook/assets/tdc-design-space-3.jpg)

