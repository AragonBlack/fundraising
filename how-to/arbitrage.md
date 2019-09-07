# Arbitrage

Curves initialised through the template support both ANT and DAI collaterals.

Each collateral having own bonding curve \(with only one curve but multiple prices displayed in the orders panel\) can result in discrepancies developing over time between for example the ANT bonding curve and DAI bonding curve. 

For small differences arbitrage could be closed with the next batches. 

If there is a large discrepancy \(for example converting the ANT price to the DAI price and noticing a 5% difference with the native DAI price\) that resists short time frames any user can buy the lower priced boding curve token and sell an equal quantity of the bonding curve priced in the other collateral. 

This results in a risk-free arbitrage opportunity for traders and allows the pricing of a bonding curve token to be in sync with multiple collaterals.

