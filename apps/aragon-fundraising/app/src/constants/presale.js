export const Presale = {
  state: {
    // presale is idle and pending to be started
    PENDING: 'PENDING',
    // presale has started and contributors can purchase tokens
    FUNDING: 'FUNDING',
    // presale has not reach presaleGoal within presalePeriod and contributors can claim refunds
    REFUNDING: 'REFUNDING',
    // presale has reached presaleGoal within presalePeriod and trading is ready to be open
    GOAL_REACHED: 'GOAL_REACHED',
    // presale has reached presaleGoal within presalePeriod, has been closed and trading has been open
    CLOSED: 'CLOSED',
  },
}
