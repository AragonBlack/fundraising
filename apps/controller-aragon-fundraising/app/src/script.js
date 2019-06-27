import Aragon, { events } from '@aragon/api'
import { first } from 'rxjs/operators'
import { of, zip } from 'rxjs'
// import { getTestTokenAddresses } from './testnet'
// import {
//   ETHER_TOKEN_FAKE_ADDRESS,
//   isTokenVerified,
//   tokenDataFallback,
//   getTokenSymbol,
//   getTokenName,
// } from './lib/token-utils'
// import { addressesEqual } from './lib/web3-utils'
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

// const tokenAbi = [].concat(tokenDecimalsAbi, tokenNameAbi, tokenSymbolAbi)

const TEST_TOKEN_ADDRESSES = []
const tokenContracts = new Map() // Addr -> External contract
const tokenDecimals = new Map() // External contract -> decimals
const tokenNames = new Map() // External contract -> name
const tokenSymbols = new Map() // External contract -> symbol

const ETH_CONTRACT = Symbol('ETH_CONTRACT')
const INITIALIZATION_TRIGGER = Symbol('INITIALIZATION_TRIGGER')

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

const externals = zip(app.call('vault'), app.call('pool'), app.call('tap'), app.call('marketMaker'))
// Get the token address to initialize ourselves
retryEvery(retry => {
  externals.subscribe(
    ([reserveAddress, poolAddress, tapAddress, marketMakerAddress]) => initialize(reserveAddress, poolAddress, tapAddress, marketMakerAddress),
    err => {
      console.error('Could not start background script execution due to the contract not loading external contract addresses:', err)
      retry()
    }
  )
})

async function initialize(reserveAddress, poolAddress, tapAddress, marketMakerAddress) {
  // TODO: Create a function that generates the settings object with a list of addresses and the corresponding apps
  // Breakout into two functions, one to intialize and the other to create state store
  const vaultContract = app.external(reserveAddress, vaultAbi)
  const poolContract = app.external(poolAddress, poolAbi)
  const tapContract = app.external(tapAddress, tapAbi)
  const marketMakerContract = app.external(marketMakerAddress, marketMakerAbi)

  console.log('Initialize')

  console.log(tapAddress)
  console.log(marketMakerAddress)
  console.log(poolAddress)
  console.log(reserveAddress)

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
    ethToken: {
      // address: ethAddress,
    },
    reserveVault: {
      address: reserveAddress,
      contract: vaultContract,
    },
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
  }

  let vaultInitializationBlock

  try {
    vaultInitializationBlock = await settings.vault.contract.getInitializationBlock().toPromise()
  } catch (err) {
    console.error("Could not get attached vault's initialization block:", err)
  }

  return app.store(
    async (state, event) => {
      if (state === null) state = { tokenSupply: 0, collateralTokens: {}, tapRate: 0, price: 0, historicalOrders: {}, cache: {} }
      const nextState = {
        ...state,
      }

      const { id, returnValues, address: eventAddress, event: eventName } = event

      if (eventName === events.SYNC_STATUS_SYNCING) {
        return { ...nextState, isSyncing: true }
      } else if (eventName === events.SYNC_STATUS_SYNCED) {
        return { ...nextState, isSyncing: false }
      }

      if (!state.cache[id]) {
        state.cache[id] = true
        state.cache.address = eventAddress

        switch (eventName) {
          case 'UpdateTapRate':
            // record when the last time the tap was updated
            break
          case 'NewOrder':
            const ORDER = {
              id: returnValues.id,
              orderType: returnValues.orderType,
              state: returnValues.state,
              amount: returnValues.amount,
              orderPrice: returnValues.orderPrice,
            }

            nextState.historicalOrders[returnValues.id] = ORDER
            return nextState
          case 'ClaimOrder':
            // get the id of the order and change its status to claimed once the tx clears and event is emitted
            return nextState
          case 'ClearOrder':
            break
          default:
            break
        }
      }

      return nextState
    },
    [
      // Always initialize the store with our own home-made event
      of({ event: INITIALIZATION_TRIGGER }),
      settings.vault.contract.events(vaultInitializationBlock),
    ]
  )
}

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

const initializeState = settings => async cachedState => {
  const newState = {
    ...cachedState,
    isSyncing: true,
    periodDuration: marshallDate(await app.call('getPeriodDuration').toPromise()),
    vaultAddress: settings.vault.address,
  }
  const withTokenBalances = await loadTokenBalances(newState, settings)
  const withTestnetState = await loadTestnetState(withTokenBalances, settings)
  const withEthBalance = await loadEthBalance(withTestnetState, settings)

  return withEthBalance
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
