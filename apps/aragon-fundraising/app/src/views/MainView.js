import React, { useState, useEffect } from 'react'
import { useApi, useAppState, useConnectedAccount } from '@aragon/api-react'
import { Layout, Tabs, Button, useLayout, ContextMenu, ContextMenuItem } from '@aragon/ui'
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
  // *****************************
  // background script state
  // *****************************
  const {
    addresses: { marketMaker: marketMakerAddress, pool },
    constants: { PPM },
    bondedToken: {
      overallSupply: { dai: daiSupply },
      address: bondedTokenAddress,
    },
    collaterals: {
      dai: { address: daiAddress, reserveRatio, toBeClaimed: daiToBeClaimed, virtualBalance: daiVirtualBalance, overallBalance: daiOverallBalance },
      ant: { address: antAddress, toBeClaimed: antToBeClaimed, virtualBalance: antVirtualBalance, overallBalance: antOverallBalance },
    },
  } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()
  const marketMakerContract = api.external(marketMakerAddress, marketMaker)

  // *****************************
  // layout name and connectedUser
  // *****************************
  const { name: layoutName } = useLayout()
  const connectedUser = useConnectedAccount()

  // *****************************
  // internal state, also shared through context
  // *****************************
  const [tabIndex, setTabindex] = useState(0)
  const [orderPanel, setOrderPanel] = useState(false)

  // *****************************
  // context state
  // *****************************
  const [polledReserveBalance, setPolledReserveBalance] = useState(null)
  const [polledDaiBalance, setPolledDaiBalance] = useState(daiOverallBalance)
  const [polledAntBalance, setPolledAntBalance] = useState(antOverallBalance)
  const [polledBatchId, setPolledBatchId] = useState(null)
  const [polledPrice, setPolledPrice] = useState(0)
  const [userBondedBalance, setUserBondedBalance] = useState(0)
  const [userDaiBalance, setUserDaiBalance] = useState(0)
  const [userAntBalance, setUserAntBalance] = useState(0)

  // react context accessible on child components
  const context = {
    reserveBalance: polledReserveBalance,
    daiBalance: polledDaiBalance,
    antBalance: polledAntBalance,
    batchId: polledBatchId,
    price: polledPrice,
    orderPanel,
    setOrderPanel,
    userBondedBalance,
    userDaiBalance,
    userAntBalance,
  }

  useEffect(() => {
    const getUserBalances = async () => {
      const balancesPromises = [bondedTokenAddress, daiAddress, antAddress].map(address => api.call('balanceOf', connectedUser, address).toPromise())
      const [bondedBalance, daiBalance, antBalance] = await Promise.all(balancesPromises)
      setUserBondedBalance(new BigNumber(bondedBalance))
      setUserDaiBalance(new BigNumber(daiBalance))
      setUserAntBalance(new BigNumber(antBalance))
    }
    if (connectedUser) {
      getUserBalances()
    }
  }, [connectedUser])

  // polls the balances, batchId and price
  useInterval(async () => {
    // polling balances and batchId
    const daiPromise = api.call('balanceOf', pool, daiAddress).toPromise()
    const antPromise = api.call('balanceOf', pool, antAddress).toPromise()
    const batchIdPromise = marketMakerContract.getCurrentBatchId().toPromise()
    const [daiBalance, antBalance, batchId] = await Promise.all([daiPromise, antPromise, batchIdPromise])
    setPolledReserveBalance(new BigNumber(daiBalance))
    setPolledDaiBalance(new BigNumber(daiBalance).minus(daiToBeClaimed).plus(daiVirtualBalance))
    setPolledAntBalance(new BigNumber(antBalance).minus(antToBeClaimed).plus(antVirtualBalance))
    setPolledBatchId(parseInt(batchId, 10))
    if (connectedUser) {
      const balancesPromises = [bondedTokenAddress, daiAddress, antAddress].map(address => api.call('balanceOf', connectedUser, address).toPromise())
      const [bondedBalance, daiBalance, antBalance] = await Promise.all(balancesPromises)
      setUserBondedBalance(new BigNumber(bondedBalance))
      setUserDaiBalance(new BigNumber(daiBalance))
      setUserAntBalance(new BigNumber(antBalance))
    }
    // polling price
    const price = await marketMakerContract.getStaticPricePPM(daiSupply.toFixed(), polledDaiBalance.toFixed(), reserveRatio.toFixed()).toPromise()
    setPolledPrice(new BigNumber(price).div(PPM))
  }, 3000)

  /**
   * Calls the `controller.withdraw` smart contarct function on button click
   * @returns {void}
   */
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
          renderActions={
            layoutName === 'small' ? (
              <ContextMenu>
                <ContextMenuItem onClick={() => setOrderPanel(true)}>New Order</ContextMenuItem>
                <ContextMenuItem onClick={() => handleWithdraw()}>Withdraw</ContextMenuItem>
              </ContextMenu>
            ) : (
              <>
                <Button mode="strong" label="Withdraw" onClick={() => handleWithdraw()}>
                  Withdraw
                </Button>
                <Button mode="strong" label="New Order" css="margin-left: 20px;" onClick={() => setOrderPanel(true)}>
                  New Order
                </Button>
              </>
            )
          }
        />
        <Tabs selected={tabIndex} onChange={setTabindex} items={tabs} />
        {tabIndex === 0 && <Overview />}
        {tabIndex === 1 && <Orders />}
        {tabIndex === 2 && <MyOrders />}
        {tabIndex === 3 && <Reserves />}
      </Layout>
      <NewOrder />
    </MainViewContext.Provider>
  )
}
