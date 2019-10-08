import React, { useEffect, useState } from 'react'
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom'
import { useApi, useAppState, useConnectedAccount } from '@aragon/api-react'
import { Header, Layout, Tabs, Button, useLayout, ContextMenu, ContextMenuItem } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import { useInterval } from '../hooks/use-interval'
import NewOrder from '../components/NewOrder'
import Disclaimer from '../components/Disclaimer'
import Reserves from '../screens/Reserves'
import Orders from '../screens/Orders'
import Overview from '../screens/Overview'
import marketMaker from '../abi/BatchedBancorMarketMaker.json'
import { MainViewContext } from '../context'
import { Polling } from '../constants'
import { IdentityProvider } from '../components/IdentityManager'

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
  const [userBondedTokenBalance, setUserBondedTokenBalance] = useState(new BigNumber(0))
  const [userDaiBalance, setUserDaiBalance] = useState(new BigNumber(0))
  const [userAntBalance, setUserAntBalance] = useState(new BigNumber(0))

  // react context accessible on child components
  const context = {
    reserveBalance: polledReserveBalance,
    daiBalance: polledDaiBalance,
    antBalance: polledAntBalance,
    batchId: polledBatchId,
    price: polledPrice,
    orderPanel,
    setOrderPanel,
    userBondedTokenBalance,
    userDaiBalance,
    userAntBalance,
  }

  // watch for a connected user and get its balances
  useEffect(() => {
    const getUserBalances = async () => {
      const balancesPromises = [bondedTokenAddress, daiAddress, antAddress].map(address => api.call('balanceOf', connectedUser, address).toPromise())
      const [bondedBalance, daiBalance, antBalance] = await Promise.all(balancesPromises)
      // TODO: keep an eye on React 17, since all updates will be batched by default
      batchedUpdates(() => {
        setUserBondedTokenBalance(new BigNumber(bondedBalance))
        setUserDaiBalance(new BigNumber(daiBalance))
        setUserAntBalance(new BigNumber(antBalance))
      })
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
    const newReserveBalance = new BigNumber(daiBalance)
    const newDaiBalance = new BigNumber(daiBalance).minus(daiToBeClaimed).plus(daiVirtualBalance)
    const newAntBalance = new BigNumber(antBalance).minus(antToBeClaimed).plus(antVirtualBalance)
    const newBatchId = parseInt(batchId, 10)
    // poling user balances
    let newUserBondedTokenBalance, newUserDaiBalance, newUserAntBalance
    if (connectedUser) {
      const balancesPromises = [bondedTokenAddress, daiAddress, antAddress].map(address => api.call('balanceOf', connectedUser, address).toPromise())
      const [bondedBalance, daiBalance, antBalance] = await Promise.all(balancesPromises)
      newUserBondedTokenBalance = new BigNumber(bondedBalance)
      newUserDaiBalance = new BigNumber(daiBalance)
      newUserAntBalance = new BigNumber(antBalance)
    }
    // polling price
    const price = await marketMakerContract.getStaticPricePPM(daiSupply.toFixed(), polledDaiBalance.toFixed(), reserveRatio.toFixed()).toPromise()
    const newPrice = new BigNumber(price).div(PPM)
    // TODO: keep an eye on React 17, since all updates will be batched by default
    // see: https://stackoverflow.com/questions/48563650/does-react-keep-the-order-for-state-updates/48610973#48610973
    // until then, it's safe to use the unstable API
    batchedUpdates(() => {
      // update the state only if value changed
      if (!newReserveBalance.eq(polledReserveBalance)) setPolledReserveBalance(newReserveBalance)
      if (!newDaiBalance.eq(polledDaiBalance)) setPolledDaiBalance(newDaiBalance)
      if (!newAntBalance.eq(polledAntBalance)) setPolledAntBalance(newAntBalance)
      if (newBatchId !== polledBatchId) setPolledBatchId(newBatchId)
      if (!newPrice.eq(polledPrice)) setPolledPrice(newPrice)
      // update user balances
      if (connectedUser) {
        if (!newUserBondedTokenBalance.eq(userBondedTokenBalance)) setUserBondedTokenBalance(newUserBondedTokenBalance)
        if (!newUserDaiBalance.eq(userDaiBalance)) setUserDaiBalance(newUserDaiBalance)
        if (!newUserAntBalance.eq(userAntBalance)) setUserAntBalance(newUserAntBalance)
      }
    })
  }, Polling.DURATION)

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

  // *****************************
  // identity handlers
  // *****************************
  const handleResolveLocalIdentity = address => {
    return api.resolveAddressIdentity(address).toPromise()
  }
  const handleShowLocalIdentityModal = address => {
    return api.requestAddressIdentityModification(address).toPromise()
  }

  return (
    <IdentityProvider onResolve={handleResolveLocalIdentity} onShowLocalIdentityModal={handleShowLocalIdentityModal}>
      <MainViewContext.Provider value={context}>
        <Header
          primary="Fundraising"
          secondary={
            layoutName === 'small' ? (
              <ContextMenu>
                <ContextMenuItem disabled={polledPrice === 0} onClick={() => setOrderPanel(true)}>
                    New Order
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleWithdraw()}>Withdraw</ContextMenuItem>
              </ContextMenu>
            ) : (
              <>
                <Button mode="strong" label="Withdraw" onClick={() => handleWithdraw()}>
                  Withdraw
                </Button>
                <Button disabled={polledPrice === 0} mode="strong" label="New Order" css="margin-left: 20px;" onClick={() => setOrderPanel(true)}>
                  New Order
                </Button>
              </>
            )
          }
        />
        <Disclaimer />
        <Tabs selected={tabIndex} onChange={setTabindex} items={tabs} />
        {tabIndex === 0 && <Overview />}
        {tabIndex === 1 && <Orders />}
        {tabIndex === 2 && <Orders myOrders />}
        {tabIndex === 3 && <Reserves />}
        <NewOrder />
      </MainViewContext.Provider>
    </IdentityProvider>
  )
}
