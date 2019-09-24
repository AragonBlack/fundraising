import React, { useState, useEffect } from 'react'
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom'
import { useAppState, useApi, useConnectedAccount } from '@aragon/api-react'
import { Layout, Button } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import { useInterval } from '../hooks/use-interval'
import { Presale as PresaleConstants } from '../constants'
import Presale from '../screens/Presale'
import AppHeader from '../components/AppHeader'
import NewContribution from '../components/NewContribution'
import { PresaleViewContext } from '../context'
import PresaleAbi from '../abi/Presale.json'

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    addresses: { presale: presaleAddress },
    presale: {
      state,
      startDate,
      contributionToken: { address },
    },
  } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()
  const presale = api.external(presaleAddress, PresaleAbi)
  const connectedUser = useConnectedAccount()

  // *****************************
  // internal state, also shared through context
  // *****************************
  const [presalePanel, setPresalePanel] = useState(false)

  // *****************************
  // context state
  // *****************************
  const [polledStartDate, setPolledStartDate] = useState(startDate)
  const [userDaiBalance, setUserDaiBalance] = useState(new BigNumber(0))
  const context = {
    startDate: polledStartDate,
    userDaiBalance,
    presalePanel,
    setPresalePanel,
  }

  // watch for a connected user and get its balances
  useEffect(() => {
    const getUserDaiBalance = async () => {
      setUserDaiBalance(new BigNumber(await api.call('balanceOf', connectedUser, address).toPromise()))
    }
    if (connectedUser) {
      getUserDaiBalance()
    }
  }, [connectedUser])

  // polls the start date
  useInterval(async () => {
    let newStartDate = polledStartDate
    let newUserDaiBalance = userDaiBalance
    // only poll if the startDate is not set yet
    if (startDate === 0) newStartDate = parseInt(await presale.startDate().toPromise(), 10)
    // only poll if there is a connected user
    if (connectedUser) newUserDaiBalance = new BigNumber(await api.call('balanceOf', connectedUser, address).toPromise())
    // TODO: keep an eye on React 17
    batchedUpdates(() => {
      // only update if values are different
      if (newStartDate !== polledStartDate) setPolledStartDate(newStartDate)
      if (!newUserDaiBalance.eq(userDaiBalance)) setUserDaiBalance(newUserDaiBalance)
    })
  }, 3000)

  return (
    <PresaleViewContext.Provider value={context}>
      <Layout>
        <AppHeader
          heading="Fundraising Presale"
          renderActions={
            <Button disabled={state !== PresaleConstants.state.FUNDING} mode="strong" label="Buy Presale Tokens" onClick={() => setPresalePanel(true)}>
              Buy Presale Tokens
            </Button>
          }
        />
        <Presale />
      </Layout>
      <NewContribution />
    </PresaleViewContext.Provider>
  )
}
