import React, { Fragment, useState, useEffect } from 'react'
import { useApi, useAppState } from '@aragon/api-react'
import { Layout, Tabs, Button, Main, SidePanel, SyncIndicator, Info, Text } from '@aragon/ui'
import BN from 'bn.js'
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
import CollateralError from './screens/CollateralError'
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
  const { isReady, common, overview, ordersView, reserve, returns } = useAppState()

  const [orderPanel, setOrderPanel] = useState(false)
  const [tabIndex, setTabindex] = useState(0)

  const api = useApi()

  const [polledReserveBalance, setPolledReserveBalance] = useState(null)
  const [polledDaiBalance, setPolledDaiBalance] = useState(null)
  const [polledAntBalance, setPolledAntBalance] = useState(null)
  const [polledBatchId, setPolledBatchId] = useState(null)
  const [polledPrice, setPolledPrice] = useState(0)
  const [augmentedOrders, setAugmentedOrders] = useState(ordersView)

  // polls the bonded token total supply, batchId, price
  useInterval(async () => {
    if (isReady) {
      const marketMakerContract = api.external(common.addresses.marketMaker, marketMaker)
      // TODO: handle externals instanciation in the app state reducer
      // balances
      const daiToken = common.collateralTokens.find(t => t.symbol === 'DAI')
      const daiPromise = api.call('balanceOf', common.addresses.pool, daiToken.address).toPromise()
      const antToken = common.collateralTokens.find(t => t.symbol === 'ANT')
      const antPromise = api.call('balanceOf', common.addresses.pool, antToken.address).toPromise()
      const [daiBalance, antBalance] = await Promise.all([daiPromise, antPromise])
      const { value } = common.bondedToken.computedSupply.find(s => s.symbol === 'DAI')
      setPolledReserveBalance(new BN(daiBalance))
      setPolledDaiBalance(new BN(daiBalance).add(daiToken.computedFactor))
      setPolledAntBalance(new BN(antBalance).add(antToken.computedFactor))

      // const price = await marketMakerContract.getStaticPrice(value.toString(), polledDaiBalance.toString(), daiToken.reserveRatio).toPromise()
      const price =
        new BN(common.ppm.toString())
          .mul(polledDaiBalance.mul(new BN('100')))
          .div(value.mul(new BN(daiToken.reserveRatio)))
          .toNumber() / 100
      setPolledPrice(price)
      // batchId
      const batchId = await marketMakerContract.getCurrentBatchId().toPromise()
      setPolledBatchId(batchId)
    }
  }, 3000)

  // update orders state when polledBatchId, ordersView or returns is changing
  useEffect(() => {
    if (polledBatchId && ordersView) setAugmentedOrders(ordersView.map(o => augmentOrder(o, returns, polledBatchId)))
    else setAugmentedOrders(ordersView)
  }, [polledBatchId, ordersView, returns])

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
    setOrderPanel(false)
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
    console.log(tapAmount)
    console.log(floor)
    console.log(common.daiAddress)
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
              <Info mode="warning" css="margin-top: 1.5rem;">
                <Text>
                  This demo of Aragon Fundraising is still in the experimental phase. It's a peek into the capabilities of the final version and we are looking
                  forward to your feedback.
                </Text>
                <Text css="display: block;">
                  You might need some Rinkeby DAI or ANT which you can get by visiting the following site:{' '}
                  <a href="https://faucet.aragon.black/">https://faucet.aragon.black/</a>
                </Text>
                <Text css="display: block;">Expect daily frontend updates and future smart contract updates.</Text>
              </Info>
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
                  price={polledPrice}
                  orders={ordersView}
                  bondedToken={common.bondedToken}
                  currentBatch={common.currentBatch}
                  collateralTokens={common.collateralTokens}
                  polledData={{ polledDaiBalance, polledBatchId, polledReserveBalance }}
                />
              )}
              {tabIndex === 1 && <Orders orders={augmentedOrders} collateralTokens={common.collateralTokens} bondedToken={common.bondedToken} />}
              {tabIndex === 2 && (
                <MyOrders
                  orders={augmentedOrders}
                  collateralTokens={common.collateralTokens}
                  bondedToken={common.bondedToken}
                  account={common.connectedAccount}
                  onClaim={handleClaim}
                />
              )}
              {tabIndex === 3 && (
                <Reserves
                  bondedToken={common.bondedToken}
                  reserve={{ ...reserve, collateralTokens: common.collateralTokens }}
                  polledData={{}}
                  updateTappedToken={handleTappedTokenUpdate}
                />
              )}
            </Layout>
            <SidePanel opened={orderPanel} onClose={() => setOrderPanel(false)} title="New Order">
              <NewOrder
                opened={orderPanel}
                collaterals={common.collateralTokens}
                bondedToken={common.bondedToken}
                polledData={{ polledDaiBalance, polledAntBalance }}
                onOrder={handlePlaceOrder}
              />
            </SidePanel>
          </Fragment>
        )}
        {isReady && !common.collateralsAreOk && <CollateralError />}
      </Main>
    </div>
  )
}

export default () => <AppLogicProvider>{isPresale ? <Presale /> : <App />}</AppLogicProvider>
