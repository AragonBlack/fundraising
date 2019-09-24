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
      openDate,
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
  const [polledOpenDate, setPolledOpenDate] = useState(openDate)
  const [userDaiBalance, setUserDaiBalance] = useState(new BigNumber(0))
  const context = {
    openDate: polledOpenDate,
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
    let newOpenDate = polledOpenDate
    let newUserDaiBalance = userDaiBalance
    // only poll if the openDate is not set yet
    if (openDate === 0) newOpenDate = parseInt(await presale.openDate().toPromise(), 10)
    // only poll if there is a connected user
    if (connectedUser) newUserDaiBalance = new BigNumber(await api.call('balanceOf', connectedUser, address).toPromise())
    // TODO: keep an eye on React 17
    batchedUpdates(() => {
      // only update if values are different
      if (newOpenDate !== polledOpenDate) setPolledOpenDate(newOpenDate)
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
