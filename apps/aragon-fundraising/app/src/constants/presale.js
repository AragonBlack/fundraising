export const Presale = {
  state: {
    // presale is idle and pending to be started
    PENDING: 'PENDING',
    // presale has started and contributors can purchase tokens
    FUNDING: 'FUNDING',
    // presale has not reach goal within period and contributors can claim refunds
    REFUNDING: 'REFUNDING',
    // presale has reached goal within period and trading is ready to be open
    GOAL_REACHED: 'GOAL_REACHED',
    // presale has reached goal within period, has been closed and trading has been open
    CLOSED: 'CLOSED',
  },
}
