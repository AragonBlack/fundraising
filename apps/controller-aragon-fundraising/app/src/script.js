import Aragon, { events } from '@aragon/api'
import { filter, first } from 'rxjs/operators'
import { from, of, zip } from 'rxjs'
// import { getTestTokenAddresses } from './testnet'
// import {
//   ETHER_TOKEN_FAKE_ADDRESS,
//   isTokenVerified,
//   tokenDataFallback,
//   getTokenSymbol,
//   getTokenName,
// } from './lib/token-utils'
import { addressesEqual } from './utils/web3'
// import tokenDecimalsAbi from './abi/token-decimals.json'
// import tokenNameAbi from './abi/token-name.json'
// import tokenSymbolAbi from './abi/token-symbol.json'
// import vaultBalanceAbi from './abi/vault-balance.json'
// import vaultGetInitializationBlockAbi from './abi/vault-getinitializationblock.json'
// import vaultEventAbi from './abi/vault-events.json'
import vaultAbi from './abi/Vault.json'
import poolAbi from './abi/Pool.json'
import tapAbi from './abi/Tap.json'
import marketMakerAbi from './abi/BancorMarketMaker.json'

const TEST_TOKEN_ADDRESSES = []
const appNames = new Map() // Addr -> Aragon App name
const tokenContracts = new Map() // Addr -> External contract
const tokenDecimals = new Map() // External contract -> decimals
const tokenNames = new Map() // External contract -> name
const tokenSymbols = new Map() // External contract -> symbol

const ETH_CONTRACT = Symbol('ETH_CONTRACT')
const INITIALIZATION_TRIGGER = Symbol('INITIALIZATION_TRIGGER')
const PERIOD_DURATION = Symbol('PERIOD_DURATION') // Every 30 Days be sure to refresh the tapRate

const app = new Aragon()

/*
 * Calls `callback` exponentially, everytime `retry()` is called.
 *
 * Usage:
 *
 * retryEvery(retry => {
 *  // do something
 *
 *  if (condition) {
 *    // retry in 1, 2, 4, 8 seconds… as long as the condition passes.
 *    retry()
 *  }
 * }, 1000, 2)
 *
 */
const retryEvery = (callback, initialRetryTimer = 1000, increaseFactor = 5) => {
  const attempt = (retryTimer = initialRetryTimer) => {
    // eslint-disable-next-line standard/no-callback-literal
    callback(() => {
      console.error(`Retrying in ${retryTimer / 1000}s...`)

      // Exponentially backoff attempts
      setTimeout(() => attempt(retryTimer * increaseFactor), retryTimer)
    })
  }
  attempt()
}

const externals = zip(app.call('reserve'), app.call('tap'), app.call('marketMaker'))
// Get the token address to initialize ourselves
retryEvery(retry => {
  console.log('TRY TO SUBSRIBE')
  externals.subscribe(
    ([poolAddress, tapAddress, marketMakerAddress]) => initialize(poolAddress, tapAddress, marketMakerAddress),
    err => {
      console.error('Could not start background script execution due to the contract not loading external contract addresses:', err)
      retry()
    }
  )
})

async function initialize(poolAddress, tapAddress, marketMakerAddress) {
  console.log('INITIALIZE')

  console.log(poolAddress)
  console.log(tapAddress)
  console.log(marketMakerAddress)

  const marketMakerContract = app.external(marketMakerAddress, marketMakerAbi)
  const tapContract = app.external(tapAddress, tapAbi)
  const poolContract = app.external(poolAddress, poolAbi)

  console.log('Before app Name')

  appNames.set(marketMakerAddress, 'bancor-market-maker.aragonpm.eth')
  appNames.set(tapAddress, 'tap.aragonpm.eth')
  appNames.set(poolAddress, 'pool.aragonpm.eth')
  // appNames.set(vaultAddress, 'vault.aragonpm.eth')

  const appAddresses = [tapAddress, marketMakerAddress, poolAddress]
  appAddresses.map(address => console.log(`Initialize ${appNames.get(address)} at ${address}`))

  console.log('After app Name')

  const network = await app
    .network()
    .pipe(first())
    .toPromise()
  // TEST_TOKEN_ADDRESSES.push(...getTestTokenAddresses(network.type))

  // Set up ETH placeholders
  // tokenContracts.set(ethAddress, ETH_CONTRACT)
  // tokenDecimals.set(ETH_CONTRACT, '18')
  // tokenNames.set(ETH_CONTRACT, 'Ether')
  // tokenSymbols.set(ETH_CONTRACT, 'ETH')

  const settings = {
    network,
    pool: {
      address: poolAddress,
      contract: poolContract,
    },
    tap: {
      address: tapAddress,
      contract: tapContract,
    },
    marketMaker: {
      address: marketMakerAddress,
      contract: marketMakerContract,
    },
    bondedToken: {
      // address: ethAddress,
    },
  }

  // let vaultInitializationBlock

  // try {
  //   vaultInitializationBlock = await settings.vault.contract.getInitializationBlock().toPromise()
  // } catch (err) {
  //   console.error("Could not get attached vault's initialization block:", err)
  // }

  console.log('NEW')

  return app.store(
    async (state, event) => {
      console.log('EVENT')
      console.log(event)

      if (state === null) state = { batches: {}, balances: {}, tokenSupply: 0, collateralTokens: {}, tapRate: 0, price: 0, historicalOrders: {}, cache: {} }

      const nextState = {
        ...state,
      }
      const { tap } = settings
      const { returnValues, address: eventAddress, event: eventName } = event

      // if (eventName === events.SYNC_STATUS_SYNCING) {
      //   console.log('SYNCING')
      //   return { ...nextState, isSyncing: true }
      // } else if (eventName === events.SYNC_STATUS_SYNCED) {
      //   console.log('SYNCED')
      //   return { ...nextState, isSyncing: false }
      // }

      // Vault event
      // if (addressesEqual(eventAddress, vault.address)) {
      //   return vaultLoadBalance(nextState, event, settings)
      // }

      switch (eventName) {
        //   case 'Withdrawal':
        //     const { amount } = returnValues

        //     if (amount < nextState.maxWithdrawal) {
        //       await app.call('widthraw', settings.bondedToken.address).toPromise()
        //       // return updateBalances(await app.call('withdraw') ....)
        //     } else {
        //       console.error(`Cannot execute withdrawal, ${amount} exceeds limit of ${nextState.maxWithdrawal}`)
        //     }

        //     return nextState
        //   case 'UpdateMonthlyTapRateIncrease':
        //     return updateMonthlyTapRateIncrease(nextState, event, settings)
        //   case 'UpdateTokenTap':
        //     return updateTokenTap(nextState, event, settings)
        //   case 'refreshMaxWithdrawal':
        //     return {
        //       ...nextState,
        //       maxWithdrawal: await tap.contract.getMaxWithdrawal(settings.bondedToken.address).toPromise(),
        //     }
        case 'NewBuyOrder':
          console.log('THIS IS A BUY ORDER !!!!')
        // return createBuyOrder(nextState, event, settings)
        //   case 'CreateSellOrder':
        //     return createSellOrder(nextState, event, settings)
        //   case 'ClaimBuyOrder':
        //     return claimBuy(nextState, event, settings)
        //   case 'ClaimSellOrder':
        //     return claimSell(nextState, event, settings)
        //   case 'ClearBatches':
        //     return clearBatches(nextState, settings)
        //   default:
        //     return nextState
      }

      return state
    },
    [tapContract.events(), marketMakerContract.events()]
  )
}

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

// const initializeState = settings => async cachedState => {
//   const newState = {
//     ...cachedState,
//     isSyncing: true,
//     vaultAddress: settings.vault.address,
//   }
//   // const withTokenBalances = await loadTokenBalances(newState, settings)
//   // const withTestnetState = await loadTestnetState(withTokenBalances, settings)
//   // const withEthBalance = await loadEthBalance(withTestnetState, settings)

//   return withEthBalance
// }

async function updateMonthlyTapRateIncrease(state, event, settings) {
  return marshallMonthlyTapRateIncrease(await app.call('updateMonthlyTapIncreasePct', event.returnValues.percentage).toPromise())
}

async function updateTokenTap(state, event, settings) {
  return marshallTapRate(await app.call('updateTokenTap', settings.bondedToken.address, event.returnValues.tap).toPromise())
}

async function createBuyOrder(state, event, settings) {
  console.log('BUY ORDER')

  let newState = {
    ...state,
  }

  // Should we pass in the order state each time?
  // Or should we set it here to 'open' until the next event that allows the user to claim the order from the batch?
  let order = {
    id: event.returnValues.id,
    orderType: 'BUY',
    state: event.returnValues.state,
    orderPrice: event.returnValues.orderPrice,
  }

  newState.historicalOrders[event.returnValues.id] = order

  await app.call('createBuyOrder', settings.bondedToken.address, event.returnValues.amount).subscribe(
    ({ buyer, collateralToken, value, batchId }) => {
      order.address = buyer
      order.collateralToken = collateralToken
      order.amount = value
      newState.batches = [...newState.batches, { batchId, order }]
    },
    err => console.error(`Could not place buy order of amount: ${event.returnValues.amount} @ price: ${event.returnValues.orderPrice}`, err)
  )

  // TODO: Marshall the date inside historical orders
  return newState
}

async function createSellOrder(state, event, settings) {
  let newState = {
    ...state,
  }

  let order = {
    id: event.returnValues.id,
    orderType: 'SELL',
    state: event.returnValues.state,
    orderPrice: event.returnValues.orderPrice,
  }

  await app.call('createSellOrder', settings.bondedToken.address, event.returnValues.amount).subscribe(
    ({ seller, collateralToken, amount, batchId }) => {
      order.address = seller
      order.collateralToken = collateralToken
      order.amount = amount
      newState.batches = [...newState.batches, { batchId, order }]
      newState.historicalOrders[event.returnValues.id] = order
    },
    err => console.error(`Could not place sell order of amount: ${event.returnValues.amount} @ price: ${event.returnValues.orderPrice}`, err)
  )

  return newState
}

async function claimBuy(state, event, settings) {
  const batch = getBatch(state, event.returnValues.batchId)
  // We don't care about the response
  batch.subscribe(async batchId => app.call.claimBuy(settings.bondedToken.address, batchId).toPromise())
  return updateClaimedOrderStatus(state, event.returnValues.orderId)
}

async function claimSell(state, event, settings) {
  const batch = getBatch(state, event.returnValues.batchId)
  batch.subscribe(async batchId => app.call.claimSell(settings.bondedToken.address, batchId).toPromise())
  return updateClaimedOrderStatus(state, event.returnValues.orderId)
}

function updateClaimedOrderStatus(state, orderId) {
  const { historicalOrders } = state

  let order = historicalOrders[orderId]
  order.state = 'Claimed'

  const newHistoricalOrders = Array.from(historicalOrders)
  newHistoricalOrders[orderId] = order

  return {
    ...state,
    historicalOrders: newHistoricalOrders,
  }
}
function getBatch(state, batchId) {
  const { batches } = state
  const source = from(batches)
  const batch = source.pipe(filter(batch => batch.batchId === batchId))
  return batch
}

async function clearBatches(state, settings) {
  await app.call('clearBatch').toPromise()
  return {
    ...state,
    batches: {},
  }
}

async function loadTokenBalances(state, settings) {
  let newState = {
    ...state,
  }
  if (!newState.balances) {
    return newState
  }

  const addresses = newState.balances.map(({ address }) => address)
  for (const address of addresses) {
    newState = {
      ...newState,
      balances: await updateBalances(newState, address, settings),
    }
  }
  return newState
}

async function vaultLoadBalance(state, { returnValues: { token } }, settings) {
  return {
    ...state,
    balances: await updateBalances(state, token || settings.ethToken.address, settings),
  }
}

async function newPeriod(state, { returnValues: { periodId, periodStarts, periodEnds } }) {
  return {
    ...state,
    periods: await updatePeriods(state, {
      id: periodId,
      startTime: marshallDate(periodStarts),
      endTime: marshallDate(periodEnds),
    }),
  }
}

async function newTransaction(state, { transactionHash, returnValues: { reference, transactionId } }, settings) {
  const transactionDetails = {
    ...(await loadTransactionDetails(transactionId)),
    reference,
    transactionHash,
    id: transactionId,
  }
  const transactions = await updateTransactions(state, transactionDetails)
  const balances = await updateBalances(state, transactionDetails.token, settings)

  return {
    ...state,
    balances,
    transactions,
  }
}

/***********************
 *                     *
 *       Helpers       *
 *                     *
 ***********************/

async function updateBalances({ balances = [] }, tokenAddress, settings) {
  const tokenContract = tokenContracts.has(tokenAddress) ? tokenContracts.get(tokenAddress) : app.external(tokenAddress, tokenAbi)
  tokenContracts.set(tokenAddress, tokenContract)

  const balancesIndex = balances.findIndex(({ address }) => addressesEqual(address, tokenAddress))
  if (balancesIndex === -1) {
    return balances.concat(await newBalanceEntry(tokenContract, tokenAddress, settings))
  } else {
    const newBalances = Array.from(balances)
    newBalances[balancesIndex] = {
      ...balances[balancesIndex],
      amount: await loadTokenBalance(tokenAddress, settings),
    }
    return newBalances
  }
}

function updatePeriods({ periods = [] }, periodDetails) {
  const periodsIndex = periods.findIndex(({ id }) => id === periodDetails.id)
  if (periodsIndex === -1) {
    return periods.concat(periodDetails)
  } else {
    const newPeriods = Array.from(periods)
    newPeriods[periodsIndex] = periodDetails
    return newPeriods
  }
}

function updateTransactions({ transactions = [] }, transactionDetails) {
  const transactionsIndex = transactions.findIndex(({ id }) => id === transactionDetails.id)
  if (transactionsIndex === -1) {
    return transactions.concat(transactionDetails)
  } else {
    const newTransactions = Array.from(transactions)
    newTransactions[transactionsIndex] = transactionDetails
    return newTransactions
  }
}

async function newBalanceEntry(tokenContract, tokenAddress, settings) {
  const [balance, decimals, name, symbol] = await Promise.all([
    loadTokenBalance(tokenAddress, settings),
    loadTokenDecimals(tokenContract, tokenAddress, settings),
    loadTokenName(tokenContract, tokenAddress, settings),
    loadTokenSymbol(tokenContract, tokenAddress, settings),
  ])

  return {
    decimals,
    name,
    symbol,
    address: tokenAddress,
    amount: balance,
    verified: isTokenVerified(tokenAddress, settings.network.type) || addressesEqual(tokenAddress, settings.ethToken.address),
  }
}

async function loadEthBalance(state, settings) {
  return {
    ...state,
    balances: await updateBalances(state, settings.ethToken.address, settings),
  }
}

function loadTokenBalance(tokenAddress, { vault }) {
  return vault.contract.balance(tokenAddress).toPromise()
}

async function loadTokenDecimals(tokenContract, tokenAddress, { network }) {
  if (tokenDecimals.has(tokenContract)) {
    return tokenDecimals.get(tokenContract)
  }

  const fallback = tokenDataFallback(tokenAddress, 'decimals', network.type) || '0'

  let decimals
  try {
    decimals = (await tokenContract.decimals().toPromise()) || fallback
    tokenDecimals.set(tokenContract, decimals)
  } catch (err) {
    // decimals is optional
    decimals = fallback
  }
  return decimals
}

async function loadTokenName(tokenContract, tokenAddress, { network }) {
  if (tokenNames.has(tokenContract)) {
    return tokenNames.get(tokenContract)
  }
  const fallback = tokenDataFallback(tokenAddress, 'name', network.type) || ''

  let name
  try {
    name = (await getTokenName(app, tokenAddress)) || fallback
    tokenNames.set(tokenContract, name)
  } catch (err) {
    // name is optional
    name = fallback
  }
  return name
}

async function loadTokenSymbol(tokenContract, tokenAddress, { network }) {
  if (tokenSymbols.has(tokenContract)) {
    return tokenSymbols.get(tokenContract)
  }
  const fallback = tokenDataFallback(tokenAddress, 'symbol', network.type) || ''

  let symbol
  try {
    symbol = (await getTokenSymbol(app, tokenAddress)) || fallback
    tokenSymbols.set(tokenContract, symbol)
  } catch (err) {
    // symbol is optional
    symbol = fallback
  }
  return symbol
}

async function loadTransactionDetails(id) {
  return marshallTransactionDetails(await app.call('getTransaction', id).toPromise())
}

function marshallTransactionDetails({ amount, date, entity, isIncoming, paymentId, periodId, token }) {
  return {
    amount,
    entity,
    isIncoming,
    paymentId,
    periodId,
    token,
    date: marshallDate(date),
  }
}

function marshallTapRate({ token, tap }) {
  const today = new Date()
  return {
    tapRate: tap,
    lastIncrease: marshallDate(today),
  }
}

function marshallMonthlyTapRateIncrease({ maxMonthlyTapIncreasePct }) {
  const today = new Date()
  return {
    maxMonthlyTapIncreasePct,
    lastUpdated: marshallDate(today),
  }
}

function marshallDate(date) {
  // Represent dates as real numbers, as it's very unlikely they'll hit the limit...
  // Adjust for js time (in ms vs s)
  return parseInt(date, 10) * 1000
}

/**********************
 *                    *
 * RINKEBY TEST STATE *
 *                    *
 **********************/

function loadTestnetState(nextState, settings) {
  // Reload all the test tokens' balances for this DAO's vault
  return loadTestnetTokenBalances(nextState, settings)
}

async function loadTestnetTokenBalances(nextState, settings) {
  let reducedState = nextState
  for (const tokenAddress of TEST_TOKEN_ADDRESSES) {
    reducedState = {
      ...reducedState,
      balances: await updateBalances(reducedState, tokenAddress, settings),
    }
  }
  return reducedState
}
