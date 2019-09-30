# c\) Intro to bonding curves



When we think about exchanging shares in a company, real estate property, cooperative, membership in a club there were until two ways of doing it: over the counter \(OTC\) or via an exchange. In OTC a buyer and a seller negociate a price \(or are put in contact through a 3rd party\) and then enter into a transaction: this is very slow and costly process that hugely reduces the liquidity of the asset. Selling a house can for example take months or years. On the other side there are order book based exchanges such as the stock market: these work for high volume assets where there are  lots of buyers and sellers such as commodities. An order book exchange matches buyer and sellers when both specify a similar price range and settles an order at their behalf.

Token bonding curves are a novel crypto-economic mechanism that provides an alternative pricing method for tokenized assets . At their core they are smart contracts that acts as an automated market maker: the bonding curve contract emits an organization token at a price that is algorithmically determined by the smart contract according to a formula specified at it's deployment and in function of variables such as token supply. 

As price increases not only according to the stakes put in by patrons but also by project revenue  patrons will stake collateral into curves they believe will increase in value. 

Thus the price of a bonding curve represents belief about the value of a project the same way a stock value price in beliefs about present and future earnings of a company. 

To note that here can be what are called "memetic curves" that can be used to curate and rank things \(media content, apps, popularity\) without any revenue backing them.

The bonding curve's pricing method guarantees liquidity: because the bonding curve's market maker is a smart contract patrons can always buy and sell tokens "back to the curve" by adding and withdrawing the amount of collateral corresponding to the price of the tokens they are buying/selling. 

From this liquidity derives a crucial property of Fundraising DAOs: their tokens are liquid and exchangeable without needing to be listed on an order book based exchange.

This allows for alignement of incentives between stakeholders: if founders do not carry on with their promises patrons can exit the curve and they will see their potential tap decreased, on the contrary if they do well on their work, the amount in reserves will increase potentially leading to a tap increase . 

Curation is encouraged as early stakers are compensated for the risk they take by having a higher rate of returns than later stakers for the same amount of collateral.

The "Aragon Fundraising Bonding Curves" section provides an in depth explainer of the bonding curves used in this implementation.

