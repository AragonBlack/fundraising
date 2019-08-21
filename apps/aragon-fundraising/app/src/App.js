import React, { Fragment, useState, useEffect } from 'react'
import { useApi, useAppState } from '@aragon/api-react'
import { Layout, Tabs, Button, Main, SidePanel, SyncIndicator } from '@aragon/ui'
import { useInterval } from './utils/use-interval'
import AppHeader from './components/AppHeader/AppHeader'
import NewOrder from './components/NewOrder'
import PresaleSidePanel from './components/PresaleSidePanel'
import Reserves from './screens/Reserves'
import Orders from './screens/Orders'
import MyOrders from './screens/MyOrders'
import Overview from './screens/Overview'
import PresaleView from './screens/Presale'
import { AppLogicProvider } from './app-logic'
import { Order } from './constants'
import miniMeTokenAbi from './abi/MiniMeToken.json'
import marketMaker from './abi/BatchedBancorMarketMaker.json'

const isPresale = false

const Presale = () => {
  const [orderPanel, setOrderPanel] = useState(false)

  return (
    <div css="min-width: 320px">
      <Main assetsUrl="./">
        <Fragment>
          <Layout>
            <AppHeader
              heading="Fundraising Presale"
              action1={
                <Button mode="strong" label="Buy Presale Tokens" onClick={() => setOrderPanel(true)}>
                  Buy Presale Tokens
                </Button>
              }
            />
            <PresaleView />
          </Layout>
          <PresaleSidePanel price={300.0} opened={orderPanel} onClose={() => setOrderPanel(false)} />
        </Fragment>
      </Main>
    </div>
  )
}

const tabs = ['Overview', 'Orders', 'My Orders', 'Reserve Settings']

/**
 * Finds whether an order is cleared or not
 * @param {Array} order - an order coming from the state.orders
 * @param {Number} currentBatchId - id of the current batch
 * @returns {boolean} true if order is cleared, false otherwise
 */
const isCleared = ({ batchId }, currentBatchId) => {
  return batchId < currentBatchId
}

/**
 * Finds whether an order is returned (aka. claimed) or not
 * @param {Array} order - an order coming from the state.orders
 * @param {Array} returns - the list of return buy and return sell, from state.returns
 * @returns {boolean} true if order is returned, false otherwise
 */
const isReturned = ({ address, collateral, batchId, type }, returns) => {
  return returns && returns.some(r => r.address === address && r.batchId === batchId && r.collateral === collateral && r.type === type)
}

const augmentOrder = (order, returns, currentBatchId) => {
  // handle order state (a returned order means it's already cleared)
  if (isReturned(order, returns)) return { ...order, state: Order.State.RETURNED }
  else if (isCleared(order, currentBatchId)) return { ...order, state: Order.State.OVER }
  else return { ...order, state: Order.State.PENDING }
}

const App = () => {
  const { isReady, common, overview, ordersView, reserve } = useAppState()

  const [orderPanel, setOrderPanel] = useState(false)
  const [tabIndex, setTabindex] = useState(0)

  const api = useApi()

  const [polledTotalSupply, setPolledTotalSupply] = useState(null)
  const [polledBatchId, setPolledBatchId] = useState(null)
  const [augmentedOrders, setAugmentedOrders] = useState(ordersView)

  // polls the bonded token total supply, batchId, price
  useInterval(async () => {
    if (isReady) {
      // totalSupply
      const bondedTokenContract = api.external(common.bondedToken.address, miniMeTokenAbi)
      const totalSupply = await bondedTokenContract.totalSupply().toPromise()
      setPolledTotalSupply(totalSupply)
      // batchId
      const marketMakerContract = api.external(common.addresses.marketMaker, marketMaker)
      const batchId = await marketMakerContract.getCurrentBatchId().toPromise()
      setPolledBatchId(batchId)
    }
  }, 3000)

  // update orders state when polledBatchId, ordersView or returns is changing
  useEffect(() => {
    if (polledBatchId && ordersView) setAugmentedOrders(ordersView.map(o => augmentOrder(o, common.returns, polledBatchId)))
    else setAugmentedOrders(ordersView)
  }, [polledBatchId, ordersView, common.returns])

  const handlePlaceOrder = async (collateralTokenAddress, amount, isBuyOrder) => {
    const intent = { token: { address: collateralTokenAddress, value: amount, spender: common.addresses.marketMaker } }
    // TODO: add error handling on failed tx, check token balances
    if (isBuyOrder) {
      console.log(`its a buy order where token: ${collateralTokenAddress}, amount: ${amount}`)
      api
        .openBuyOrder(collateralTokenAddress, amount, intent)
        .toPromise()
        .catch(console.error)
    } else {
      console.log(`its a sell order where token: ${collateralTokenAddress}, amount: ${amount}`)
      api
        .openSellOrder(collateralTokenAddress, amount)
        .toPromise()
        .catch(console.error)
    }
  }

  const handleClaim = (batchId, collateralTokenAddress, isBuyOrder) => {
    // TODO: add error handling on failed tx, check token balances
    if (isBuyOrder) {
      console.log(`its a buy claim where token: ${collateralTokenAddress}, batchId: ${batchId}`)
      api
        .claimBuyOrder(batchId, collateralTokenAddress)
        .toPromise()
        .catch(console.error)
    } else {
      console.log(`its a sell claim where token: ${collateralTokenAddress}, batchId: ${batchId}`)
      api
        .claimSellOrder(batchId, collateralTokenAddress)
        .toPromise()
        .catch(console.error)
    }
  }

  const handleTappedTokenUpdate = (tapAmount, floor) => {
    api
      .updateTokenTap(common.daiAddress, tapAmount, floor)
      .toPromise()
      .catch(console.error)
  }

  const handleWithdraw = () => {
    api
      .withdraw(common.daiAddress)
      .toPromise()
      .catch(console.error)
  }

  return (
    <div css="min-width: 320px">
      <Main assetsUrl="./">
        <SyncIndicator visible={!isReady} />
        {isReady && common.collateralsAreOk && (
          <Fragment>
            <Layout>
              <AppHeader
                heading="Fundraising"
                action1={
                  <Button mode="strong" label="Withdraw" onClick={() => handleWithdraw()}>
                    Withdraw
                  </Button>
                }
                action2={
                  <Button mode="strong" label="New Order" css="margin-left: 20px;" onClick={() => setOrderPanel(true)}>
                    New Order
                  </Button>
                }
              />
              <Tabs selected={tabIndex} onChange={setTabindex} items={tabs} />
              {tabIndex === 0 && (
                <Overview
                  overview={overview}
                  bondedToken={common.bondedToken}
                  currentBatch={common.currentBatch}
                  polledData={{ polledTotalSupply, polledBatchId }}
                />
              )}
              {tabIndex === 1 && <Orders orders={augmentedOrders} />}
              {tabIndex === 2 && <MyOrders orders={augmentedOrders} account={common.connectedAccount} onClaim={handleClaim} />}
              {tabIndex === 3 && (
                <Reserves
                  bondedToken={common.bondedToken}
                  reserve={{ ...reserve, collateralTokens: common.collateralTokens }}
                  polledData={{ polledTotalSupply }}
                  updateTappedToken={handleTappedTokenUpdate}
                />
              )}
            </Layout>
            <SidePanel opened={orderPanel} onClose={() => setOrderPanel(false)} title="New Order">
              <NewOrder
                opened={orderPanel}
                collaterals={common.collateralTokens}
                bondedToken={common.bondedToken}
                price={overview.startPrice}
                onOrder={handlePlaceOrder}
              />
            </SidePanel>
          </Fragment>
        )}
        {isReady && !common.collateralsAreOk && <h1>Something wrong with the collaterals</h1>}
      </Main>
    </div>
  )
}

export default () => <AppLogicProvider>{isPresale ? <Presale /> : <App />}</AppLogicProvider>
