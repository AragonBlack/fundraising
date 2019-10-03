# Aragon Fundraising Bonding Curves

## Automated Market Makers

Bonding Curves use a pricing algorithm to serve as an automated market maker and provide an always available source of liquidity. 

Depending on the algorithm used markets can be made to be more or less sensitive to price volatility. Users can interact with a bonding curve by staking tokens into the bonding curve’s reserve pool, when they do the bonding curve mints corresponding tokens for the user based on the the pricing algorithm. The newly minted tokens can have specific utility and even be traded among users, but can always be exchanged back through the bonding curve for tokens in the bonding curve’s reserve pool.

## Reserve Pool

A reserve pool is necessary for the bonding curve to function as an automated market maker. If funds are removed from the reserve pool it impacts the pricing algorithm, and if the reserve is depleted entirely the bonding curve will no longer function at all. Therefore, it is critical that the process of removing funds from the reserve pool is strictly limited.

### Withdrawing from the Reserve Pool

For organizations to make use of funds in the reserve to reward contributors the funds must first be withdrawn from the reserve pool and into a discretionary pool. To ensure projects remain accountable to token holders, the rate at which tokens can be withdrawn from the reserve is rate limited and cannot ever go below a floor. For each token accepted by the organizations Bonding Curve the following variables are used to define the withdrawal rate.

| Variable Name | Datatype | Purpose |
| :--- | :--- | :--- |
| tap | number | The number of tokens per second which can be withdrawn from the reserve |
| lastWithdraw | timestamp | Tracks the block timestamp of the most recent withdrawal |
| minRatio | percent | The minimum ratio of tokens in the reserve pool relative to outstanding project tokens |

These variables enable the organization to rate-limit the flow of funds from the reserve pool into the discretionary pool, this keeps the project contributors accountable by releasing funds over time and giving individuals an opportunity to exit by drawing down funds in the reserve pool before they are released to the discretionary pool. The minRatio parameter ensures that the Bonding Curve remains a functional source of liquidity for the project.

### **Liquidating the Reserve Pool**

In some cases a majority of the token holders will all want to sell at once, this can occur if the project encounters an issue that makes it clear that it should not continue or if key members of the team decide to leave the project. Rather than rushing to exit via the bonding curve, the community can vote to liquidate the reserve pool returning funds to the bonding curves token holders on a pro-rata basis.

## Discretionary Pool

Funds which have moved from the bonding curve’s reserve pool to the organization’s discretionary pool can be directly governed by the organization \(see section 3 for more details\). These funds can be used to reward contributors to the project.

## Pricing Algorithm

In order for a bonding curve to function an algorithmic pricing function must be used to determine how many tokens should be minted when tokens are added to the reserve pool and how many tokens from the reserve pool should be given to the user when they return project tokens back to the curve. The pricing formula used by Bancor provides a good starting point.

### **Bancor Pricing Formula**

In the Bancor Protocol smart tokens manage by a bonding curve which maintains a constant reserve ratio between tokens held in reserve \(Connector Tokens\) and the corresponding smart tokens total value \(market cap\). The ratio between them is called the connector weight \(CW\).

CW = Connector Balance / \(price \* Smart Token supply\)

We can then algebraically solve for price as follows:

Price = connector balance / \(smart token supply x CW\)

Different Connector Weight measures modify the slope of the curve and the response of price to token supply. 

As you can see a CW close to 100% approximates a stable-coin: the bonding curve token's price is the same regardless of the amount of collateral in the pool. On the contrary a low CW results in more rewards for early patrons but becomes very volatile after a certain inflexion point.

![Numbers and slope are illustrative and will vary according to a host of variables ](https://lh4.googleusercontent.com/ahqOfYhIIA6Sm-JN1FDe_7MXT9mlj_CGiObVzdM07UZGHshNmK0FHVGDTuGVjUnlHnUX6_sPdzdww042pLb6gt8jiycikk00ltPx9LZZYxr6Kj5G-cRReBEvL7ep8DX6f9mxA_ki)

### **Apiary Pricing Formula**

Because the Bancor pricing formula maintains a constant reserve ratio \(CW\) as tokens are bought and burned, the process of moving funds from the reserve pool into the discretionary pool would decrease CW. To account for that we need to adjust the pricing formula so that CW increases based on a bondPremium parameter as people buy tokens so that CW floats between minRatio and maxRatio values.

When an individual uses the bonding curve to mint tokens and the current CW is less than maxRatio users are required to stake additional tokens relative to the current price, this amount is determined by the bondPremium.

As funds move from the reserve pool to the discretionary pool the CW will decrease, when it reaches minRatio no more withdrawals to the discretionary pool will be permitted.

## Front-running

Since the Bonding Curve is managed by a smart contract and transactions are public the mechanism is vulnerable to front-running. These attacks were explored by Ivan Bogatyy along with some possible mitigations. Front-running occurs when someone sees a pending transaction and then makes a new transaction that is included before the pending transaction, changing how the original transaction executes. This can happen if front-runners use a higher gas price, or if they are miners/stakers who are in a position to select and order transactions for block inclusion.

**2.5.1 minReturn**

In the web3.0 UI a minReturn value can be calculated for the user that will cause the trade to fail if the price differs significantly between when the transaction was processed and when the transaction was created. This ensures that users do not accidently purchase a price which is significantly different than expected, but ultimately is only a solution in the cases where users would choose not to buy at the new price and effectively allows front-runners to block transactions.

**2.5.2 maxGasPrice**

Non-miner front-running can be eliminated by requiring a fixed maxGasPrice for transactions accepted by the contract. Since a higher price cannot be used to ensure the front-runner’s transaction occurs first, they are unable to effectively front-run transactions. However, this decision means that in times of high network congestion the contract may become unavailable.

**2.5.3 Commit-reveal transactions**

A more robust solution is to use a commit-reveal scheme where transactions are ordered while hidden, preventing attempts to front-run by both regular users and miners. This requires users to make two transactions adding cost and complexity to the user experience.

**2.5.4 Apiary approach**

Front-running is a legitimate theoretical concern for bonding curve mechanisms but we must weigh the risk versus practical usability.

Specifying a maxGasPrice will prevent front-running by non-block producers and given the possibility of liquidating the reserve pool pro-rata in the event of a black swan event the issue of intermittent illiquidity seems like a reasonable tradeoff for security.

Implementing minReturn can be effective mitigation against front-running by block-producers who are only able to front-run when they are in the position to produce a new block. Additionally as Ethereum moves to proof-of-stake, the incentives of the long-term incentives of block-producers will more closely align with the long-term usability of the network, so sustained malicious front running by block producers may be uncommon.

If despite these mitigations front-running becomes a significant problem more robust solutions such as commit-reveal transactions can be implemented to resolve the issue.

