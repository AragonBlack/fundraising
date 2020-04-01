# Overview

Until today DAOs were capable of a variety of things: vote to enact an action, survey the opinion of a group, hold and allocate funds, etc. There are many more possibilities and you can browse some of them by testing Aragon [here](https://mainnet.aragon.org/). However DAOs had no straight-forward way of having capital enter and exit in a liquid fashion.

The solution adopted by Aragon Fundraising is called a **DAICO - Decentralized Autonomous ICO -** or **Continuous Organization** where an organization emits a token throughout what is called a continuous fundraising campaign. A DAICO is characterised by its transparency, accountability and liquidity.

## How does it work?

Investors can, at any moment in time, purchase or redeem a DAO specific token - thereafter named `SHARE` - against a certain amount of collateral such as `DAI` or `ANT` flowing in and out of the campaign **reserve pool**.  The emission or redemption of this `SHARE` token is automatically enforced by a smart contract ensuring the **absolute liquidity** of this token. Moreover, the price of this `SHARE` token is **automatically adjusted** based on its supply through a **bonding curve.**

Every time period - for example every month - a fraction of the reserve pool is **tapped to flow towards another address** and fund the expenses of the campaign's underlying project. This tap rate can be updated by the investors thus ensuring the **accountability of the organization** toward its investors. Compared to traditional equity or token based fundraising methods there is no lump sum given to founders of a project. Instead, the amount available for expenses fluctuates over time. Terms of investment are transparent and equal for all participants. Project revenue can also be sent to the reserve pool, thus increasing the value of the `SHARE` token and attracting patrons that wish to benefit from subsequent price increases.

## What is a bonding-curve?

When we think about exchanging shares in a company, real estate, cooperative, etc. there are traditionally two ways of doing it: over the counter  - OTC - or via an exchange. In OTC a buyer and a seller negociate a price - or are put in contact through a 3rd party - and then enter into a transaction: this is a very slow and costly process that hugely reduces the liquidity of the asset. Selling a house can for example take months or years. On the other side there are order book based exchanges such as the stock market: these work for high volume assets such as commodities where there are lots of buyers and sellers. An order book exchange matches buyer and sellers when both specify a similar price range and settles an order at their behalf.

**Token bonding curves are a novel crypto-economic mechanism that provides an alternative pricing method for tokenized assets**. They rely on smart contracts that act as an automated market maker: the bonding curve contract emits or burns an organization token at a price that is algorithmically determined by a given formula. More specifically, Aragon Fundraising rely on the [Bancor Protocol formula](https://about.bancor.network/protocol/).

## Bancor Formula

In the Bancor Protocol the bonding curve maintains a constant **reserve ratio** between the amount of collateral tokens held in the reserve reserve pool and the bonded token total value - it's market cap. This reserve ratio is called the connector weight - `CW` - so that:

$$
price_{token} = \frac{balance_{collateral}}{supply_{token} * CW}
$$

The choice of a Connector Weight will shape the slope of the curve and the response of price to token supply. A `CW` close to 100% approximates a stable-coin: the bonding curve token's price is the same regardless of the amount of collateral in the pool. On the contrary a low `CW` results in more rewards for early patrons but becomes very volatile after a certain inflexion point. In the case of Aragon Fundraising the **`CW` is set by default to 10% for `DAI` and 1% for `ANT`**. Note that this may be modified through custom deployements.

![Numbers and slope are illustrative and will vary according to various variables ](https://lh4.googleusercontent.com/ahqOfYhIIA6Sm-JN1FDe_7MXT9mlj_CGiObVzdM07UZGHshNmK0FHVGDTuGVjUnlHnUX6_sPdzdww042pLb6gt8jiycikk00ltPx9LZZYxr6Kj5G-cRReBEvL7ep8DX6f9mxA_ki)



As price increases not only according to the stakes put in by investors but also by the funds sends back from the organization's revenue stream to the reserve pool, investors will stake collateral into curves they believe will increase in value. Thus the price of a bonding curve represents belief about the value of a project the same way a stock value price in beliefs about present and future earnings of a company. 



