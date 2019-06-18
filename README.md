# Aragon Fundraising App

## Architecture

![Architecture](.github/images/architecture.svg)

## Contracts

### BondingCurve

#### Interface

```text
function buy(uint256 _value) external payable;
function sell(uint256 _amount) external;
```

#### Roles

|             | Description                                |       Grantee |
| :---------- | :----------------------------------------- | ------------: |
| `BUY_ROLE`  | Buy bonds against ETH or ERC-20 collateral | `ANY_ADDRESS` |
| `SELL_ROLE` | Redeem bonds for ETH or ERC-20 collateral  | `ANY_ADDRESS` |

### CollateralPool

#### Interface

```text
function deposit(address _token, uint256 _value) external payable;
function transfer(address _token, uint256 _value) external;
function execute(address _target, bytes _data) external;
```

#### Roles

|                     | Description                                               |                                         Grantee |
| :------------------ | :-------------------------------------------------------- | ----------------------------------------------: |
| `DEPOSIT_ROLE`      | Deposit ETH or ERC-20 into the `CollateralPool`           |                    `BondingCurve` contract\[s\] |
| `TRANSFER_ROLE`     | Transfer ETH or ERC-20 out of the `CollateralPool`        | `BondingCurve` contract\[s\] and `Tap` contract |
| `SAFE_EXECUTE_ROLE` | Execute balance neutral transactions on external contract |                        `Voting [BOND]` contract |

#### Notes

Depending on the token address the contract must also hook into the `BondingCurve` contract to let it \[optionally\] update its `vBalance` state variable \[thus reflecting the requested changes in the price curve\]

### Tap

#### Interface

```text
function updateTokenTap(address _token, uint256 _tap) external;
function removeTokenTap(address _token) external;
function updateVault(address _vault) external;
function withdraw() external;
```

#### Roles

|                   | Description                                                                              |                  Grantee |
| :---------------- | :--------------------------------------------------------------------------------------- | -----------------------: |
| `UPDATE_TAP_ROLE` | Update tap rate                                                                          | `Voting [BOND]` contract |
| `WITHDRAW_ROLE`   | Initialize ETH or ERC-20 `transfer` on the `CollateralPool` to the discretionary `Vault` |            `ANY_ADDRESS` |

#### Notes

Implementing the tap system as an external contract owning TRANSFER_ROLE over the `CollateralPool` contract provides more modularity than implementing it directly into the `CollateralPool` contract.

The tap contract upon initialization allows the user to set the max percentage the tap can be raised per 30-day period.
