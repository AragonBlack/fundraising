# Aragon Fundraising in a few words

Aragon Fundraising is a suite of **Aragon** apps providing Aragon organizations continuous fundraising capabilities.

 It enables users to buy and redeem one organization's token through an automated **market maker** automatically matching orders according to a **bonding curve** tied to the **Bancor** formula. The funds held by this market maker r**eserve pool** are controlled by a **tap** and released over time into a **discretionary pool** controlled by the organization's board to sustain the project. This architecture provides smart-contract enforced **accountability** between investors and board members throughout the lifecycle of a project while simultaneously ensuring **sufficient liquidity** to support the emergence of a **long-tail of micro-organizations**. To achieve these goals Aragon Fundraising implements the following features.



![](../.gitbook/assets/image.png)

### Automatic Batched Market Making

This module provides market liquidity to the fundraising campaign by automatically matching all the buy and sell orders according to a bonding curve tied to the Bancor formula. To mitigate front-running attacks and authorizing slow-trading this module also batches all the buy and sell orders received during a parametrable period of time to be matched given a common price.

### Tap

This module enforce a tap-based control of the funds allowed to be withdrawn from the market-maker reserve pool to a discretionnary pool whose funds can be spent to sustain the organization. To provide more guarantees to the investors this tap module also allows this flow of funds to be floored \[thus ensuring that the market maker reserve pool can't be emptied even slowly during a long period of time\].

**Controller**

The controller app interacts with the bonding curve on behalf of a User.

### Presale

This module allows organizations to set a presale target that must be reached during a given period of time for the continuous fundraising campaign to actually start.

### 

