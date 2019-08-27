# Background script general structure

## Overview tab

What we need here:

### **Price**

*Expressed in DAI*

Price can be computed out of the following formula [each collateral may have a different price]. It can also be obtained with the following call on the `marketMaker` contract: `getStaticPrice` or `getStaticPricePPM`.
```
ppm * overallBalance(reserve, collateral)  / (overallSupply(collateral) * reserveRatio(collateral))
```
- `ppm`: precision constant fetched from `marketMaker` contract
- `reserveRatio`: reserve ratio of the collateral the price is computed on [fetched from `AddCollateralToken` or `UpdateCollateralToken` event]

- `overallBalance(reserve, collateral)`: `balanceOf(reserve, collateral) + virtualBalance(collateral) - collateralsToBeClaimed(collateral)` 
- `balanceOf(reserve, collateral)`: reserve balance accounting for tap ticking [fetched from the `controller` contract]
- `collateralsToBeClaimed(collateral)` : self-explanatory [fetched from `marketMaker` contract]
- `overallSupply(collateral)`: `bondedToken.totalSupply + bondedToken.tokensToBeMinted + virtualSupply(collateral)`



### **Market cap**

*Expressed in DAI*

Market cap can be obtained with the following formula:
```
marketCap = price * overallSupply = price * (totalSupply + tokensToBeMinted)
```

- `totalSupply` and `tokensToBeMinted` are related to the `bondedToken`

### **Trading volume**

*Expressed in DAI*

Sum of the **DAI** value of both buy and sell orders.

### **Token supply**

```
realSupply = totalSupply + tokensToBeMinted
```

### **Reserves**

*Expressed in DAI*

```
realBalance(dai) = balanceOf(reserve, dai) - collateralsToBeClaimed(dai)
```


### **Monthly allowance**

*Expressed in DAI/month*

Can be found on the `tap` object, and converted in DAI/month

## Orders/My Orders tabs

Orders get their prices and informations about the collateral from the background script.
By default, an order is considered as 'pending'

The state of each orders depends on 2 things:
- if the order can be found on the list of claimed orders, then the order is 'returned' (no need to check if the order is over)
- if the the current batch ID is greater than the batchId of the order, then the batch is 'over'

This calculation means you need to call the `marketMakerContract.getCurrentBatchId()` on a regular basis on the frontend.

Recalculate the state of the orders when one of the following occurs:
- new currentBatchId
- new order
- new claim

On the "My orders" tab, filter the orders by the connected user (accessible via the `useConnectedAccount()` hook of `aragon.js`)

**TODO:** This could be optimized, we don't need to recalculate state of already returned orders.

**TODO:**: This should be refactored when this PR https://github.com/aragon/aragon.js/pull/361 gets merged and published in a new version of aragon.js

## Reserve

There's 2 tapped token, but we only care about the DAI.

### **Monthly allowance**

*Expressed in DAI/month*

Can be found on the `tap` object, and converted in DAI/month

### **Floor**

*Expressed in DAI*

Can be found on the `tap` object

### **Collateralization ratios**

(TODO: Why displaying ANT collateralization ratio ?)

*In percents*

```
ratio = reserveRatio / ppm
```

- `ppm`: in `marketMaker` contract
- `reserveRatio`: in the current collateral token

### **Total supply**

`totalSupply` of the bonded token, minus the `tokenToBeMinted`

- `totalSupply` and `tokensToBeMinted` are related to the `bondedToken`

### **Token**

`name` and `symbol` of the bonded token

- `name` and `symbol` are related to the `bondedToken`

## Actions

### **New Order**

Place a new buy or sell order with the following calls: `openBuyOrder` and `openSellOrder` passing the following arguments:
- `address`: the address of the collateral used
- `amount`: amount of collateral or token

To calculate the conversion between the collateral and the bonded token, we use `calculatePurchaseReturn` or `calculateSaleReturn` calls on the `BancorFormula` contract with the following arguments:
- `supply`: `totalSupply` of the bonded token + `tokensToBeMinted` of the bonded token + `virtualSupply` of the current collateral
- `balance`: `balanceOf(pool, collateral)` the balance of the given collateral in the `pool`
- `weight`: TODO: ????
- `amount`: amount of buy or sell

### **Edit monthly allocation**

Update monthly allocation and floor according to the following rules:

- no more than one increase per month. Check last update with `timestamp` on the tapped token
- no restrictions on decrease
- an increase should fit within the `maximumTapIncreasePct`
- no particular rules on the `floor` (TODO: what about preventing floor increase over reserve balance ?)

### **Claim**

Just a call to `claimBuyOrder` or `claimSellOrder` on the `controller` passing the `batchId` and `collateral` address to be claimed.

### **Withdraw**

Just a call to `withdraw` on the `controller` passing the `collateral` address to withdraw.


## Charts

### **Bonding curve**

TODO: TBD

### **History chart**

Passing the list of `batches` where the startingPrice is calculated with the following formula on the background script:

```
startPrice = (balance * ppm) / (supply * reserveRatio)
```

All values coming from the event, except `ppm` which can be found on the background script state.

(TODO: Should we continue to calculate it on the background script ?)