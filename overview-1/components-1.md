# Components

The Aragon Fundraising App suite is made up of five components: a reserve-pool, a presale, a market-maker, a tap and controller.

## Reserve pool

The reserve pool module is the contract to which the **collateralized funds** used to purchase bonds / shares of the organization are sent to. The reserve pool is implemented as a [Agent](https://aragon.org/agent/) app enabling shareholders to interact with external contracts. Though both `ANT` and `DAI` transfers are prevented by the default template, shareholders can still use these collateralized funds to perform constant-balance external transactions - _e.g._ vote on AGPs.

## Presale

The presale module handles the presale phase of the fundraising campaign. It enables organizations to define **a presale target that must be reached during a given period of time** for the continuous fundraising campaign to actually start. If this goal is not reached during this given period of time, the continuous fundraising campaign _won't_ open and the existing presale contributors can ask their contributions to be refunded. If one starts a fundraising campaign and the presale fails, it needs to re-deploy a new fundraising DAO to start a new campaign.

The presale module also vests the shares purchased during the presale. This vesting is enforced through the `SHARE` [Token Manager](https://wiki.aragon.org/archive/dev/apps/token-manager/). This mechanism enables the campaign board to make sure that `SHARE` purchased during the presale won't get dumped just after the continuous fundraising campaign opens.

## **Market Maker**

The market maker module provides market liquidity to the fundraising campaign by automatically matching all the buy and sell orders according to a [bonding curve tied to the Bancor Formula](b-fundraising-for-daos-1.md). To mitigate front-running attacks and authorizing slow-trading this module also batches all the buy and sell orders received during a parametrable period of time to be matched given a common price.

Because of this batching mechanism, orders can not be passed and returned in one sole transaction. One first need to open an order, wait for the current batch to be over, and then perform a second transaction to claim the return of their order. 

## Tap

The tap module enforce a tap-based control of the funds allowed to be withdrawn from the market-maker reserve pool to a discretionnary pool whose funds can be spent to sustain the organization. To provide more guarantees to the investors this tap module also allows this flow of funds to be floored, thus ensuring that the market maker reserve pool can't be emptied even slowly during a long period of time.

## Controller

The controller module works as an API contract forwarding all incoming transaction to one of the previous module. End users can only interact with this contract.



