import Aragon, { events } from '@aragon/api'
import { zip } from 'rxjs'
import { first } from 'rxjs/operators'
import cloneDeep from 'lodash.clonedeep'
import { tokenDataFallback, getTokenSymbol, getTokenName } from './lib/token-utils'
import poolAbi from './abi/Pool.json'
import tapAbi from './abi/Tap.json'
import marketMakerAbi from './abi/BatchedBancorMarketMaker.json'
import miniMeTokenAbi from './abi/MiniMeToken.json'
import tokenDecimalsAbi from './abi/token-decimals.json'
import tokenNameAbi from './abi/token-name.json'
import tokenSymbolAbi from './abi/token-symbol.json'
import retryEvery from './utils/retryEvery'
import { Order } from './constants'

// abis used to call decimals, name and symbol on a token
const tokenAbi = [].concat(tokenDecimalsAbi, tokenNameAbi, tokenSymbolAbi)

// Maps to maintain relationship between an address and a contract and its related data.
// It avoids redundants calls to the blockchain
const tokenContracts = new Map() // Addr -> External contract
const tokenDecimals = new Map() // External contract -> decimals
const tokenNames = new Map() // External contract -> name
const tokenSymbols = new Map() // External contract -> symbol

// bootstrap the Aragon API
const app = new Aragon()

// get the token address to initialize ourselves
const externals = zip(app.call('reserve'), app.call('tap'), app.call('marketMaker'))
retryEvery(retry => {
  externals.subscribe(
    ([poolAddress, tapAddress, marketMakerAddress]) => initialize(poolAddress, tapAddress, marketMakerAddress),
    err => {
      console.error('Could not start background script execution due to the contract not loading external contract addresses:', err)
      retry()
    }
  )
})

const initialize = async (poolAddress, tapAddress, marketMakerAddress) => {
  // get external smart contracts to listen to their events and interact with them
  const marketMakerContract = app.external(marketMakerAddress, marketMakerAbi)
  const tapContract = app.external(tapAddress, tapAbi)
  const poolContract = app.external(poolAddress, poolAbi)

  // preload bonded token contract
  const bondedTokenAddress = await marketMakerContract.token().toPromise()
  const bondedTokenContract = app.external(bondedTokenAddress, miniMeTokenAbi)

  // preload bancor formula address
  const formulaAddress = await marketMakerContract.formula().toPromise()

  // get network characteristics
  const network = await app
    .network()
    .pipe(first())
    .toPromise()

  // some settings used by subsequent calls
  const settings = {
    network,
    marketMaker: {
      address: marketMakerAddress,
      contract: marketMakerContract,
    },
    tap: {
      address: tapAddress,
      contract: tapContract,
    },
    pool: {
      address: poolAddress,
      contract: poolContract,
    },
    bondedToken: {
      address: bondedTokenAddress,
      contract: bondedTokenContract,
    },
    formula: {
      address: formulaAddress,
    },
  }

  // init the aragon API store
  // first param is a function handling blockchain events and updating the store'state accordingly
  // second param is an object with a way to get the initial state (cached one, in the client's IndexedDB)
  // and the external contracts on which we want to listen events
  return app.store(
    async (state, evt) => {
      // prepare the next state from the current one
      const nextState = {
        ...state,
      }
      console.log('#########################')
      console.log(evt.event)
      console.log(evt)
      console.log('#########################')
      const { event, returnValues, blockNumber, transactionHash } = evt
      switch (event) {
        // app is syncing
        case events.SYNC_STATUS_SYNCING:
          return { ...nextState, isSyncing: true }
        // done syncing
        case events.SYNC_STATUS_SYNCED:
          return { ...nextState, isSyncing: false }
        /***********************
         * Fundraising events
         ***********************/
        case 'AddCollateralToken':
        case 'UpdateCollateralToken':
          return handleCollateralToken(nextState, returnValues, settings)
        case 'RemoveCollateralToken':
          return removeCollateralToken(nextState, returnValues)
        case 'AddTappedToken':
        case 'UpdateTappedToken':
          return handleTappedToken(nextState, returnValues, blockNumber)
        case 'NewBuyOrder':
        case 'NewSellOrder':
          return newOrder(nextState, returnValues, settings, blockNumber, transactionHash)
        case 'ReturnBuyOrder':
        case 'ReturnSellOrder':
          return newReturn(nextState, returnValues, settings)
        case 'NewBatch':
          return newBatch(nextState, returnValues, blockNumber)
        case 'UpdatePricing':
          return updatePricing(nextState, returnValues)
        case 'UpdateMaximumTapIncreasePct':
          return updateMaximumTapIncreasePct(nextState, returnValues)
        default:
          return nextState
      }
    },
    {
      init: initState(settings),
      externals: [marketMakerContract, tapContract, poolContract].map(c => ({ contract: c })),
    }
  )
}

/**
 * Merges the initial state with the cached one (in the client's IndexedDB))
 * @param {Object} settings - the settings needed to access external contracts data
 * @returns {Object} a merged state between the cached one and data coming from external contracts
 */
const initState = settings => async cachedState => {
  const newState = {
    ...cachedState,
    isSyncing: true,
    addresses: {
      marketMaker: settings.marketMaker.address,
      tap: settings.tap.address,
      pool: settings.pool.address,
      formula: settings.formula.address,
    },
    network: settings.network,
  }
  const withContractsData = await loadContractsData(newState, settings)
  const withDefaultValues = loadDefaultValues(withContractsData)
  return withDefaultValues
}

/**
 * Loads relevant data related to the fundraising smart contracts
 * @param {Object} state - the current store's state
 * @param {Object} settings - the settings needed to access external contracts data
 * @returns {Object} the current store's state augmented with the smart contracts data
 */
const loadContractsData = async (state, { bondedToken, marketMaker, tap }) => {
  // loads data related to the bonded token, market maker and tap contracts
  const [symbol, name, decimals, totalSupply, toBeMinted, PPM, maximumTapIncreasePct, PCT_BASE] = await Promise.all([
    bondedToken.contract.symbol().toPromise(),
    bondedToken.contract.name().toPromise(),
    bondedToken.contract.decimals().toPromise(),
    bondedToken.contract.totalSupply().toPromise(),
    marketMaker.contract.tokensToBeMinted().toPromise(),
    marketMaker.contract.PPM().toPromise(),
    tap.contract.maximumTapIncreasePct().toPromise(),
    tap.contract.PCT_BASE().toPromise(),
  ])
  return {
    ...state,
    constants: {
      ...state.constants,
      PPM,
      PCT_BASE,
    },
    values: {
      ...state.values,
      maximumTapIncreasePct,
    },
    bondedToken: {
      address: bondedToken.address,
      symbol,
      name,
      decimals: parseInt(decimals, 10),
      totalSupply,
      toBeMinted,
      // realSupply and overallSupply will be calculated on the reducer
    },
  }
}

/**
 * Intialize background script state with default values
 * @param {Object} state - the current store's state
 * @returns {Object} the current store's state augmented with default values where needed
 */
const loadDefaultValues = state => {
  // set empty maps and arrays if not populated yet
  // (that's why new values are on top of the returned object, will be overwritten if exists in the state)
  // for collaterals, orders, batches
  return {
    collaterals: new Map(),
    orders: [],
    batches: [],
    ...state,
  }
}

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

const handleCollateralToken = async (state, { collateral, reserveRatio, slippage, virtualBalance, virtualSupply }, settings) => {
  const collaterals = cloneDeep(state.collaterals)
  // find the corresponding contract in the in memory map or get the external
  const tokenContract = tokenContracts.has(collateral) ? tokenContracts.get(collateral) : app.external(collateral, tokenAbi)
  tokenContracts.set(collateral, tokenContract)
  // loads data related to the collateral token
  const [symbol, name, decimals, actualBalance, toBeClaimed] = await Promise.all([
    loadTokenSymbol(tokenContract, collateral, settings),
    loadTokenName(tokenContract, collateral, settings),
    loadTokenDecimals(tokenContract, collateral, settings),
    loadTokenBalance(collateral, settings),
    loadCollateralsToBeClaimed(collateral, settings),
  ])
  collaterals.set(collateral, {
    symbol,
    name,
    decimals: parseInt(decimals, 10),
    reserveRatio,
    virtualSupply,
    virtualBalance,
    actualBalance, // will be polled on the frontend too, until aragon.js PR#361 gets merged
    toBeClaimed, // will be updated when a new order or new claim event is catched
    slippage,
  })
  return {
    ...state,
    collaterals,
  }
}

const removeCollateralToken = (state, { collateral }) => {
  // find the corresponding contract in the in memory map or get the external
  const tokenContract = tokenContracts.has(collateral) ? tokenContracts.get(collateral) : app.external(collateral, tokenAbi)
  // remove all data related to this token
  tokenContracts.delete(collateral)
  tokenDecimals.delete(tokenContract)
  tokenNames.delete(tokenContract)
  tokenSymbols.delete(tokenContract)
  const collaterals = cloneDeep(state.collaterals).delete(collateral)
  return {
    ...state,
    collaterals,
  }
}

const handleTappedToken = async (state, { token, tap: rate, floor }, blockNumber) => {
  const collaterals = cloneDeep(state.collaterals)
  const timestamp = await loadTimestamp(blockNumber)
  const tap = { rate, floor, timestamp }
  collaterals.set(token, { ...collaterals.get(token), tap })
  return {
    ...state,
    collaterals,
  }
}

const newOrder = async (state, { buyer, seller, collateral, batchId, value, amount }, settings, blockNumber, transactionHash) => {
  // if it's a buy order, seller and amount will undefined
  // if it's a sell order, buyer and value will be undefined
  const orders = cloneDeep(state.orders)
  const tokenContract = tokenContracts.has(collateral) ? tokenContracts.get(collateral) : app.external(collateral, tokenAbi)
  const [timestamp, symbol, bondedToken, collaterals] = await Promise.all([
    loadTimestamp(blockNumber),
    loadTokenSymbol(tokenContract, collateral, settings),
    updateBondedToken(state.bondedToken, settings),
    updateCollateralsToken(state.collaterals, collateral, settings),
  ])
  orders.push({
    transactionHash,
    timestamp,
    batchId: parseInt(batchId, 10),
    collateral,
    symbol,
    user: buyer || seller,
    type: buyer ? Order.type.BUY : Order.type.SELL,
    state: Order.state.PENDING, // start with a PENDING state
    amount, // can be undefined
    value, // can be undefined
    // price is calculated in the reducer
  })
  return {
    ...state,
    orders,
    bondedToken,
    collaterals,
  }
}

const newReturn = async (state, { buyer, seller, collateral, batchId, value, amount }, settings) => {
  // if it's a buy return, seller and value will undefined
  // if it's a sell return, buyer and amount will be undefined
  const user = buyer || seller
  const type = buyer ? Order.type.BUY : Order.type.SELL
  const orders = cloneDeep(state.orders)
    // find orders concerned by this event and update values
    .map(o => {
      if (o.user === user && o.batchId === parseInt(batchId, 10) && o.collateral === collateral && o.type === type) {
        return {
          ...o,
          amount: o.amount ? o.amount : amount, // update amount for a buy order
          value: o.value ? o.value : value, // update value for a sell order
          state: Order.state.CLAIMED,
        }
      } else return o
    })
  const [bondedToken, collaterals] = await Promise.all([
    updateBondedToken(state.bondedToken, settings),
    updateCollateralsToken(state.collaterals, collateral, settings),
  ])
  return {
    ...state,
    orders,
    bondedToken,
    collaterals,
  }
}

const newBatch = async (state, { id, collateral, supply, balance, reserveRatio }, blockNumber) => {
  const batches = cloneDeep(state.batches)
  const timestamp = await loadTimestamp(blockNumber)
  batches.push({
    id: parseInt(id, 10),
    timestamp,
    collateral,
    supply,
    balance,
    reserveRatio,
    // startPrice, buyPrice, sellPrice are calculated in the reducer
    // totalBuySpend, totalBuyReturn, totalSellReturn, totalSellSpend updated via updatePricing events
  })
  return {
    ...state,
    batches,
  }
}

const updatePricing = (state, { batchId, collateral, totalBuyReturn, totalBuySpend, totalSellReturn, totalSellSpend }) => {
  const batches = cloneDeep(state.batches).map(b => {
    if (b.id === parseInt(batchId, 10) && b.collateral === collateral) {
      return {
        ...b,
        totalBuySpend,
        totalBuyReturn,
        totalSellSpend,
        totalSellReturn,
      }
    } else return b
  })
  return {
    ...state,
    batches,
  }
}

const updateMaximumTapIncreasePct = (state, { maximumTapIncreasePct }) => {
  return {
    ...state,
    values: {
      ...state.values,
      maximumTapIncreasePct,
    },
  }
}

/***********************
 *                     *
 *       Helpers       *
 *                     *
 ***********************/

/**
 * Get the current balance of a given collateral
 * @param {String} tokenAddress - the given token address
 * @param {Object} settings - the settings where the pool address is
 * @returns {Promise} a promise that resolves the balance
 */
const loadTokenBalance = (tokenAddress, { pool }) => {
  return app.call('balanceOf', pool.address, tokenAddress).toPromise()
}

/**
 * Get the current amount of collaterals to be claimed for the given collateral
 * @param {String} tokenAddress - the given token address
 * @param {Object} settings - the settings where the marketMaker contract is
 * @returns {Promise} a promise that resolves the collaterals to be claimed
 */
const loadCollateralsToBeClaimed = (tokenAddress, { marketMaker }) => {
  return marketMaker.contract.collateralsToBeClaimed(tokenAddress).toPromise()
}

/**
 * Get the decimals of a given token contract
 * @param {String} tokenContract - token contract
 * @param {String} tokenAddress - token address
 * @param {Object} settings - settings object where the network details are
 * @returns {String} the decimals or a fallback (decimals are optional)
 */
const loadTokenDecimals = async (tokenContract, tokenAddress, { network }) => {
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

/**
 * Get the name of a given token contract
 * @param {String} tokenContract - token contract
 * @param {String} tokenAddress - token address
 * @param {Object} settings - settings object where the network details are
 * @returns {String} the name or a fallback (name is optional)
 */
const loadTokenName = async (tokenContract, tokenAddress, { network }) => {
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

/**
 * Get the symbol of a given token contract
 * @param {String} tokenContract - token contract
 * @param {String} tokenAddress - token address
 * @param {Object} settings - settings object where the network details are
 * @returns {String} the symbol or a fallback (symbol is optional)
 */
const loadTokenSymbol = async (tokenContract, tokenAddress, { network }) => {
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

/**
 * Gets the timestamp of the given block
 * @param {String} blockNumber - the block number of which we want the timestamp
 * @returns {Number} the timestamp of the given block in ms
 */
const loadTimestamp = async blockNumber => {
  const block = await app.web3Eth('getBlock', blockNumber).toPromise()
  return parseInt(block.timestamp, 10) * 1000 // in ms
}

/**
 * Updates the bonded token when an order or claim happens
 * @param {Object} bondedToken - the bonded token to update
 * @param {Object} settings - settings object where the needed contracts are
 * @returns {Object} the updated bonded token
 */
const updateBondedToken = async (bondedToken, settings) => {
  const updatedBondedToken = cloneDeep(bondedToken)
  const [toBeMinted, totalSupply] = await Promise.all([
    settings.marketMaker.contract.tokensToBeMinted().toPromise(),
    settings.bondedToken.contract.totalSupply().toPromise(),
  ])
  return {
    ...updatedBondedToken,
    toBeMinted,
    totalSupply,
  }
}

/**
 * Updates the collaterals tokens when an order or claim happens
 * @param {Map} collaterals - map of the collaterals
 * @param {String} collateral - current address of the collateral to update
 * @param {Object} settings - settings object where the needed contracts are
 * @returns {Object} the updated collaterals
 */
const updateCollateralsToken = async (collaterals, collateral, settings) => {
  const updatedCollaterals = cloneDeep(collaterals)
  updatedCollaterals.set(collateral, {
    ...updatedCollaterals.get(collateral),
    toBeClaimed: await loadCollateralsToBeClaimed(collateral, settings),
  })
  return updatedCollaterals
}
