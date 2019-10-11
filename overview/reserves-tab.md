# Reserves Tab and providing Accountability with the Tap

![](https://lh3.googleusercontent.com/njnXJHdym1dLFpTTC5eo1C-_104fihz63RYqsX6nX15uyRZPmMZ7GzT4oZnS8Fn3LeEFH5WcJsyhaz4VSY7LhotRe42vqqGi2K2hEASEkLlh5lLzWwLLx7ejfx9nlpY5wodyyXgN)

 

The Reserves tab displays essential information on the Fundraising settings. 

In the box on the right the current token supply and name of the Fundraising Token is displayed.

In the main box the monthly allocation is displayed in tokens per month. 

The floor is a parameter that sets a minimum floor the amount in the curve before halting withdrawals.   


There is then displayed the various collateralization ratios corresponding to the different supported collateral tokens.  


Updating the Monthly Allocation can be made by clicking on editing  monthly allocation which then triggers an action defined by the permissions, by default this is a vote of Shares token holders.



The tap is the amount of tokens of collateral that can be withdrawn from the reserves per time period by founders to sustain the underlying project.

The tap is defined in the smart contracts by "the number of tokens per second which can be withdrawn from the reserve". 

In the Fundraising app the default measure is in tokens of collateral per month in absolute value. This measure can be updated by a certain % every period \(by default 10% per month\). This updating mechanism is restricted to x % per month.

The beneficiary of the tap can be updated via a request by any user that is authorised by the permission system \(such as a BOARD or SHARE token holder\). This would trigger a vote by SHARE token holders.  


