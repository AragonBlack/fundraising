import React, { useEffect, useState } from 'react'
import { AragonApi, useAppState, useApi, useGuiStyle } from '@aragon/api-react'
import { Main, SyncIndicator } from '@aragon/ui'
import appStateReducer from './appStateReducer'
import { useInterval } from './hooks/use-interval'
import MainView from './views/MainView'
import PresaleView from './views/PresaleView'
import CollateralError from './screens/CollateralError'
import { Presale, Polling } from './constants'
import PresaleAbi from './abi/Presale.json'

import './assets/global.css'

const App = () => {
  // *****************************
  // background script state
  // *****************************
  const { isReady, collateralsAreOk, addresses, presale } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()
  const { appearance } = useGuiStyle()
  // *****************************
  // internal state
  // *****************************
  const [isPresale, setIsPresale] = useState(null)
  const [presaleContract, setPresaleContract] = useState(null)

  // check when the app is ready (it will mean presale state and addresses too)
  // if so get the presale state and contract
  useEffect(() => {
    if (isReady) {
      setIsPresale(presale.state !== Presale.state.CLOSED)
      setPresaleContract(api.external(addresses.presale, PresaleAbi))
    }
  }, [isReady])

  // check if we are on presale when the app is mounted
  useEffect(() => {
    const checkIsPresale = async () => {
      const newPresaleState = Object.values(Presale.state)[await presaleContract.state().toPromise()]
      setIsPresale(newPresaleState !== Presale.state.CLOSED)
    }
    // once presale ended, no need to check anymore
    if (isReady && !isPresale) checkIsPresale()
  }, [])

  // polls if we are on presale
  useInterval(async () => {
    // once presale ended, no need to check anymore
    if (isReady && !isPresale) {
      const newPresaleState = Object.values(Presale.state)[await presaleContract.state().toPromise()]
      const newIsPresale = newPresaleState !== Presale.state.CLOSED
      if (newIsPresale !== isPresale) setIsPresale(newIsPresale)
    }
  }, Polling.DURATION)

  return (
    <Main theme={appearance} assetsUrl="./aragon-ui">
      <SyncIndicator visible={!isReady || isPresale === null} />
      {isPresale && isReady && collateralsAreOk && <PresaleView />}
      {!isPresale && isReady && collateralsAreOk && <MainView />}
      {isReady && !collateralsAreOk && <CollateralError />}
    </Main>
  )
}

export default () => (
  <AragonApi reducer={appStateReducer}>
    <App />
  </AragonApi>
)
