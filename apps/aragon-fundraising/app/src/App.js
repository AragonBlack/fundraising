import React from 'react'
import { AragonApi, useAppState } from '@aragon/api-react'
import appStateReducer from './appStateReducer'
import { Main, SyncIndicator } from '@aragon/ui'
import MainView from './views/MainView'
import PresaleView from './views/PresaleView'
import CollateralError from './screens/CollateralError'

// TODO: handle it the right way
const isPresale = false

const App = () => {
  // *****************************
  // background script state
  // *****************************
  const { isReady, collateralsAreOk } = useAppState()

  return (
    <Main>
      <SyncIndicator visible={!isReady} />
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
