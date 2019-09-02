import React, { useState } from 'react'
import { useApi, useAppState } from '@aragon/api-react'
import { Layout, Tabs, Button, SidePanel } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import { useInterval } from '../hooks/use-interval'
import AppHeader from '../components/AppHeader'
import NewOrder from '../components/NewOrder'
import Disclaimer from '../components/Disclaimer'
import Reserves from '../screens/Reserves'
import Orders from '../screens/Orders'
import MyOrders from '../screens/MyOrders'
import Overview from '../screens/Overview'
import marketMaker from '../abi/BatchedBancorMarketMaker.json'
import { MainViewContext } from '../context'

const tabs = ['Overview', 'Orders', 'My Orders', 'Reserve Settings']

export default () => {
  const {
    addresses: { marketMaker: marketMakerAddress, pool },
    bondedToken: {
      overallSupply: { dai: daiSupply },
    },
    collaterals: {
      dai: { address: daiAddress, reserveRatio, toBeClaimed: daiToBeClaimed, virtualBalance: daiVirtualBalance, overallBalance: daiOverallBalance },
      ant: { address: antAddress, toBeClaimed: antToBeClaimed, virtualBalance: antVirtualBalance, overallBalance: antOverallBalance },
    },
  } = useAppState()

  const api = useApi()
  const marketMakerContract = api.external(marketMakerAddress, marketMaker)

  const [tabIndex, setTabindex] = useState(0)
  const [orderPanel, setOrderPanel] = useState(false)

  const [polledReserveBalance, setPolledReserveBalance] = useState(null)
  const [polledDaiBalance, setPolledDaiBalance] = useState(daiOverallBalance)
  const [polledAntBalance, setPolledAntBalance] = useState(antOverallBalance)
  const [polledBatchId, setPolledBatchId] = useState(null)
  const [polledPrice, setPolledPrice] = useState(0)

  // react context accessible on child components
  const context = {
    polledData: {
      reserveBalance: polledReserveBalance,
      daiBalance: polledDaiBalance,
      antBalance: polledAntBalance,
      batchId: polledBatchId,
      price: polledPrice,
    },
    order: {
      orderPanel,
      setOrderPanel,
    },
  }

  // polls the balances, batchId and price
  useInterval(async () => {
    // polling balances and batchId
    const daiPromise = api.call('balanceOf', pool, daiAddress).toPromise()
    const antPromise = api.call('balanceOf', pool, antAddress).toPromise()
    const batchIdPromise = marketMakerContract.getCurrentBatchId().toPromise()
    const [daiBalance, antBalance, batchId] = await Promise.all([daiPromise, antPromise, batchIdPromise])
    setPolledReserveBalance(new BigNumber(daiBalance))
    setPolledDaiBalance(new BigNumber(daiBalance).plus(daiToBeClaimed).minus(daiVirtualBalance))
    setPolledAntBalance(new BigNumber(antBalance).plus(antToBeClaimed).minus(antVirtualBalance))
    setPolledBatchId(parseInt(batchId, 10))
    // polling price
    const price = await marketMakerContract.getStaticPricePPM(daiSupply.toFixed(), polledDaiBalance.toFixed(), reserveRatio.toFixed()).toPromise()
    setPolledPrice(price)
  }, 3000)

  const handleWithdraw = () => {
    api
      .withdraw(daiAddress)
      .toPromise()
      .catch(console.error)
  }

  return (
    <MainViewContext.Provider value={context}>
      <Layout>
        <Disclaimer />
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
        {tabIndex === 0 && <Overview />}
        {tabIndex === 1 && <Orders />}
        {tabIndex === 2 && <MyOrders />}
        {tabIndex === 3 && <Reserves />}
      </Layout>
      <SidePanel opened={orderPanel} onClose={() => setOrderPanel(false)} title="New Order">
        <NewOrder />
      </SidePanel>
    </MainViewContext.Provider>
  )
}
