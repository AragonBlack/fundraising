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

DAI is the only tapped token

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
- an increase should fit within the `maximumTapRateIncreasePct`
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

## JSON view of the frontend state

```json
{
    "constants": {
        "PPM": BigNumber,
        "PCT_BASE": BigNumber
    },
    "values": {
        "maximumTapRateIncreasePct": BigNumber
    },
    "network": {
        "id": Number,
        "type": String // "private or rinkeby or main"
    },
    "addresses": {
        "marketMaker": address,
        "formula": address,
        "tap": address,
        "reserve": address
    },
    "presale": {
        "state": String, // "PENDING", "FUNDING", "REFUNDING", "GOAL_REACHED" or "CLOSED"
        "contributionToken": {
            "address": String,
            "symbol": String,
            "name": String,
            "decimals": Number,
        },
        "token": {
            "address": String,
            "symbol": String,
            "name": String,
            "decimals": Number,
        },
        "startDate": Date, // "timestamp, also polled from the frontend"
        "presalePeriod": Number,
        "vestingCliffPeriod": Number,
        "vestingCompletePeriod": Number,
        "tokenExchangeRate": BigNumber,
        "presaleGoal": BigNumber,
        "totalRaised": BigNumber // "polled from the frontend"
    },
    "collaterals": {
        "dai": {
            "address": String,
            "symbol": String,
            "name": String,
            "decimals": Number,
            "reserveRatio": BigNumber,
            "virtualSupply": BigNumber,
            "virtualBalance": BigNumber,
            "toBeClaimed": BigNumber,
            "actualBalance": BigNumber, // "this one needs to fetched from frontend for now ..."
            "realBalance": BigNumber, // "= actualBalance - toBeClaimed"
            "overallBalance": BigNumber, // "=realBalance + virtualBalance"
            "tap" : { // only for DAI
                "rate": BigNumber,
                "floor": BigNumber,
                "timestamp": Number
            },
            "slippage": BigNumber
        },
        "ant": {
        }
    },
    "bondedToken": {
        "address": String,
        "symbol": String,
        "name": String,
        "decimals": Number,
        "totalSupply": BigNumber,
        "toBeMinted": BigNumber,
        "realSupply": BigNumber, // "= totalSupply + toBeMinted"
        "overallSupply": {
           "dai":  BigNumber, // "=realSupply + virtualBalance(dai)"
           "ant":  BigNumber // "=realSupply + virtualBalance(ant)"
        }
    },
    "batches": {
      "id": Number,
      "timestamp": Date,
      "collateral": address || String,
      "supply": BigNumber,
      "balance": BigNumber,
      "reserveRatio": BigNumber,
      "totalBuySpend": BigNumber,
      "totalBuyReturn": BigNumber,
      "totalSellSpend": BigNumber,
      "totalSellReturn": BigNumber,
      "startPrice": BigNumber, // "=(balance * PPM) / (supply * reserveRatio)"
      "buyPrice": BigNumber, // "=totalBuySpend / totalBuyReturn"
      "sellPrice": BigNumber // "=totalSellReturn / totalSellSpend"
    },
    "orders": {
        "transactionHash": String,
        "timestamp": Date,
        "batchId": Number,
        "collateral": String,
        "symbol": String,
        "user": String,
        "type": String, // "BUY or SELL"
        "state": String, // "PENDING or OVER or RETURNED"
        "amount": BigNumber, // "always expressed in number of bonds"
        "value": BigNumber, // "always expressed in number of collaterals"
        "price": BigNumber, // "derived in app-reducer from batch parameters"
    }
}
```