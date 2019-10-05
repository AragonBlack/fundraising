import Aragon, { events } from '@aragon/api'
import { zip } from 'rxjs'
import { first } from 'rxjs/operators'
import cloneDeep from 'lodash/cloneDeep'
import poolAbi from './abi/Pool.json'
import tapAbi from './abi/Tap.json'
import marketMakerAbi from './abi/BatchedBancorMarketMaker.json'
import presaleAbi from './abi/Presale.json'
import miniMeTokenAbi from './abi/MiniMeToken.json'
import tokenDecimalsAbi from './abi/token-decimals.json'
import tokenNameAbi from './abi/token-name.json'
import tokenSymbolAbi from './abi/token-symbol.json'
import retryEvery from './utils/retryEvery'
import { Order, Presale } from './constants'

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

// store metabatches to later set the realSupply to the batches
const metabatches = new Map()

// get the token address to initialize ourselves
const externals = zip(app.call('reserve'), app.call('tap'), app.call('marketMaker'), app.call('presale'))
retryEvery(() => {
  externals
    .toPromise()
    .then(([poolAddress, tapAddress, marketMakerAddress, presaleAddress]) => {
      initialize(poolAddress, tapAddress, marketMakerAddress, presaleAddress)
    })
    .catch(err => {
      console.error('Could not start background script execution due to the contract not loading external contracts:', err)
      throw err
    })
})

const initialize = async (poolAddress, tapAddress, marketMakerAddress, presaleAddress) => {
  // get external smart contracts to listen to their events and interact with them
  const marketMakerContract = app.external(marketMakerAddress, marketMakerAbi)
  const tapContract = app.external(tapAddress, tapAbi)
  const poolContract = app.external(poolAddress, poolAbi)
  const presaleContract = app.external(presaleAddress, presaleAbi)

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
    presale: {
      address: presaleAddress,
      contract: presaleContract,
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
  // second param is an object with a way to refresh the initial loaded state (cached one, in the client's IndexedDB)
  // and the external contracts on which we want to listen events
  return app.store(
    async (state, evt) => {
      // prepare the next state from the current one
      const nextState = {
        ...state,
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('#########################')
        console.log(evt.event)
        console.log(evt)
        console.log('#########################')
      }
      const { event, returnValues, blockNumber, transactionHash, logIndex } = evt
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
        case 'ResetTappedToken':
          return resetTappedToken(nextState, returnValues, blockNumber)
        case 'OpenBuyOrder':
        case 'OpenSellOrder':
          return newOrder(nextState, returnValues, settings, blockNumber, transactionHash, logIndex)
        case 'ClaimBuyOrder':
        case 'ClaimSellOrder':
          return newClaim(nextState, returnValues, settings)
        case 'NewBatch':
          return newBatch(nextState, returnValues, blockNumber)
        case 'NewMetaBatch':
          return newMetaBatch(nextState, returnValues)
        case 'UpdatePricing':
          return updatePricing(nextState, returnValues)
        case 'UpdateMaximumTapRateIncreasePct':
          return updateMaximumTapRateIncreasePct(nextState, returnValues)
        case 'UpdateMaximumTapFloorDecreasePct':
          return updateMaximumTapFloorDecreasePct(nextState, returnValues)
        case 'SetOpenDate':
          return setOpenDate(nextState, returnValues, settings)
        case 'Contribute':
          return addContribution(nextState, returnValues, settings, blockNumber)
        case 'Close':
          return closePresale(nextState)
        case 'Refund':
          return removeContribution(nextState, returnValues)
        default:
          return nextState
      }
    },
    {
      init: initState(settings),
      externals: [marketMakerContract, tapContract, poolContract, presaleContract].map(c => ({ contract: c })),
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
    isSyncing: true,
    addresses: {
      marketMaker: settings.marketMaker.address,
      tap: settings.tap.address,
      pool: settings.pool.address,
      presale: settings.presale.address,
      formula: settings.formula.address,
    },
    network: settings.network,
    ...cachedState,
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
const loadContractsData = async (state, { bondedToken, marketMaker, tap, presale, network }) => {
  // loads data related to the bonded token, market maker, tap and presale contracts
  const [
    symbol,
    name,
    decimals,
    totalSupply,
    toBeMinted,
    PPM,
    maximumTapRateIncreasePct,
    maximumTapFloorDecreasePct,
    PCT_BASE,
    presaleState,
    openDate,
    period,
    vestingCliffPeriod,
    vestingCompletePeriod,
    goal,
    totalRaised,
    exchangeRate,
    contributionToken,
    token,
  ] = await Promise.all([
    // bonded token data
    bondedToken.contract.symbol().toPromise(),
    bondedToken.contract.name().toPromise(),
    bondedToken.contract.decimals().toPromise(),
    bondedToken.contract.totalSupply().toPromise(),
    // market maker data
    marketMaker.contract.tokensToBeMinted().toPromise(),
    marketMaker.contract.PPM().toPromise(),
    // tap data
    tap.contract.maximumTapRateIncreasePct().toPromise(),
    tap.contract.maximumTapFloorDecreasePct().toPromise(),
    tap.contract.PCT_BASE().toPromise(),
    // presale data
    presale.contract.state().toPromise(),
    presale.contract.openDate().toPromise(),
    presale.contract.period().toPromise(),
    presale.contract.vestingCliffPeriod().toPromise(),
    presale.contract.vestingCompletePeriod().toPromise(),
    presale.contract.goal().toPromise(),
    presale.contract.totalRaised().toPromise(),
    presale.contract.exchangeRate().toPromise(),
    presale.contract.contributionToken().toPromise(),
    presale.contract.token().toPromise(),
  ])
  // find the corresponding contract in the in memory map or get the external
  const contributionTokenContract = tokenContracts.has(contributionToken) ? tokenContracts.get(contributionToken) : app.external(contributionToken, tokenAbi)
  tokenContracts.set(contributionToken, contributionTokenContract)
  const tokenContract = tokenContracts.has(token) ? tokenContracts.get(token) : app.external(token, tokenAbi)
  tokenContracts.set(token, tokenContract)
  // load presale contributionToken data
  const [contributionTokenSymbol, contributionTokenName, contributionTokenDecimals, tokenSymbol, tokenName, tokenDecimals] = await Promise.all([
    loadTokenSymbol(contributionTokenContract, contributionToken, { network }),
    loadTokenName(contributionTokenContract, contributionToken, { network }),
    loadTokenDecimals(contributionTokenContract, contributionToken, { network }),
    loadTokenSymbol(tokenContract, token, { network }),
    loadTokenName(tokenContract, token, { network }),
    loadTokenDecimals(tokenContract, token, { network }),
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
      maximumTapRateIncreasePct,
      maximumTapFloorDecreasePct,
    },
    presale: {
      state: Object.values(Presale.state)[presaleState],
      contributionToken: {
        address: contributionToken,
        symbol: contributionTokenSymbol,
        name: contributionTokenName,
        decimals: parseInt(contributionTokenDecimals, 10),
      },
      token: {
        address: token,
        symbol: tokenSymbol,
        name: tokenName,
        decimals: parseInt(tokenDecimals, 10),
      },
      openDate: parseInt(openDate, 10) * 1000, // in ms
      period: parseInt(period, 10) * 1000, // in ms
      vestingCliffPeriod: parseInt(vestingCliffPeriod, 10) * 1000, // in ms
      vestingCompletePeriod: parseInt(vestingCompletePeriod, 10) * 1000, // in ms
      exchangeRate,
      goal,
      totalRaised,
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
    contributions: new Map(),
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

const handleTappedToken = async (state, { token, rate, floor }, blockNumber) => {
  const collaterals = cloneDeep(state.collaterals)
  const timestamp = await loadTimestamp(blockNumber)
  const tap = { rate, floor, timestamp }
  collaterals.set(token, { ...collaterals.get(token), tap })
  return {
    ...state,
    collaterals,
  }
}

const resetTappedToken = async (state, { token }, blockNumber) => {
  const collaterals = cloneDeep(state.collaterals)
  const timestamp = await loadTimestamp(blockNumber)
  const currentCollateral = collaterals.get(token)
  const tap = { ...currentCollateral.tap, timestamp }
  collaterals.set(token, { ...currentCollateral, tap })
  return {
    ...state,
    collaterals,
  }
}

const newOrder = async (state, { buyer, seller, collateral, batchId, value, amount }, settings, blockNumber, transactionHash, logIndex) => {
  const orders = cloneDeep(state.orders)
  // if it's a buy order, seller and amount will undefined
  // if it's a sell order, buyer and value will be undefined
  const tokenContract = tokenContracts.has(collateral) ? tokenContracts.get(collateral) : app.external(collateral, tokenAbi)
  const [timestamp, symbol, bondedToken, collaterals] = await Promise.all([
    loadTimestamp(blockNumber),
    loadTokenSymbol(tokenContract, collateral, settings),
    updateBondedToken(state.bondedToken, settings),
    updateCollateralsToken(state.collaterals, collateral, settings),
  ])
  const newOrder = {
    transactionHash,
    logIndex,
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
  }
  // because of chain re-orgs, events can be fired more than once
  // transactionHash + logIndex + batchId make a good uniqueness identifier
  const orderIndex = orders.findIndex(o => {
    return o.transactionHash === transactionHash && o.logIndex === logIndex && o.batchId === parseInt(batchId, 10)
  })
  const orderFound = orderIndex !== -1
  // update the order in place if already in the list
  if (orderFound) orders[orderIndex] = newOrder
  // add the order if not in the list
  else orders.push(newOrder)
  return {
    ...state,
    orders,
    bondedToken,
    collaterals,
  }
}

const newClaim = async (state, { buyer, seller, collateral, batchId, value, amount }, settings) => {
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

const newBatch = async (state, { id: batchId, collateral, supply, balance, reserveRatio }, blockNumber) => {
  const batches = cloneDeep(state.batches)
  const timestamp = await loadTimestamp(blockNumber)
  const id = parseInt(batchId, 10)
  const { virtualBalance } = state.collaterals.get(collateral)
  const newBatch = {
    id,
    timestamp,
    collateral,
    supply,
    realSupply: metabatches.get(id),
    balance,
    virtualBalance,
    reserveRatio,
    // realBalance, startPrice, buyPrice, sellPrice are calculated in the reducer
    // totalBuySpend, totalBuyReturn, totalSellReturn, totalSellSpend updated via updatePricing events
  }
  // because of chain re-orgs, events can be fired more than once
  // id makes a good uniqueness identifier
  const batchIndex = batches.findIndex(b => b.id === parseInt(id, 10))
  const batchFound = batchIndex !== -1
  // update the batch in place if already in the list
  if (batchFound) batches[batchIndex] = newBatch
  // add the batch if not in the list
  else batches.push(newBatch)
  return {
    ...state,
    batches,
  }
}

const newMetaBatch = (state, { id, supply }) => {
  metabatches.set(parseInt(id, 10), supply)
  return state
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

const updateMaximumTapRateIncreasePct = (state, { maximumTapRateIncreasePct }) => {
  return {
    ...state,
    values: {
      ...state.values,
      maximumTapRateIncreasePct,
    },
  }
}

const updateMaximumTapFloorDecreasePct = (state, { maximumTapFloorDecreasePct }) => {
  return {
    ...state,
    values: {
      ...state.values,
      maximumTapFloorDecreasePct,
    },
  }
}

const setOpenDate = async (state, { date }, { presale }) => {
  const openDate = parseInt(date, 10) * 1000 // in ms
  // update the state of the presale
  const presaleState = await presale.contract.state().toPromise()
  return {
    ...state,
    presale: {
      ...state.presale,
      state: Object.values(Presale.state)[presaleState],
      openDate,
    },
  }
}
const addContribution = async (state, { contributor, value, amount, vestedPurchaseId }, { presale }, blockNumber) => {
  // get the user contributions
  const contributions = cloneDeep(state.contributions)
  const userContributions = contributions.get(contributor) || []
  // we call `presale.contract.totalRaised` instead of directly to the claculation here
  // because we can't make BigNumber calculations from the background script
  // and pass it to the fronted
  const [totalRaised, timestamp] = await Promise.all([presale.contract.totalRaised().toPromise(), loadTimestamp(blockNumber)])
  const newContribution = {
    value,
    amount,
    vestedPurchaseId,
    timestamp,
  }
  const contributionIndex = userContributions.findIndex(c => c.contributor === contributor && c.vestedPurchaseId === vestedPurchaseId)
  const contributionFound = contributionIndex !== -1
  // update the contribution in place if already in the list
  if (contributionFound) userContributions[contributionIndex] = newContribution
  // add the contribution if not in the list
  else userContributions.push(newContribution)
  contributions.set(contributor, userContributions)
  return {
    ...state,
    presale: {
      ...state.presale,
      totalRaised,
    },
    contributions,
  }
}

const closePresale = state => ({
  ...state,
  presale: {
    ...state.presale,
    state: Presale.state.CLOSED,
  },
})

const removeContribution = (state, { contributor, value, amount, vestedPurchaseId }) => {
  const contributions = cloneDeep(state.contributions)
  const userContributions = contributions.get(contributor)
  if (userContributions) {
    const newUserContributions = userContributions.filter(c => c.vestedPurchaseId !== vestedPurchaseId)
    contributions.set(contributor, newUserContributions)
    return {
      ...state,
      contributions,
    }
  } else return state
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
  const fallback = '0'
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
  const fallback = ''
  let name
  try {
    name = (await tokenContract.name().toPromise()) || fallback
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
  const fallback = ''
  let symbol
  try {
    symbol = (await tokenContract.symbol().toPromise()) || fallback
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
