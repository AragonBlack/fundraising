import BigNumber from 'bignumber.js'

function appStateReducer(state) {
  const { historicalOrders } = state || {}

  const ordersBN = historicalOrders
    ? historicalOrders.map(order => ({
        ...order,
        amount: new BigNumber(order.amount),
        // Note that numbers in `numData` are not safe for accurate
        // computations (but are useful for making divisions easier) aka price data.
        numData: {
          amount: parseInt(order.amount, 10),
        },
      }))
    : []

  // TODO: update the token balances for the bondedToken for each user

  return {
    ...state,
    historicalOrders: ordersBN,
  }
}

export default appStateReducer
