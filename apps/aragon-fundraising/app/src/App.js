import React from 'react'
import { AragonApi, useAppState } from '@aragon/api-react'
import appStateReducer from './appStateReducer'
import { Main, SyncIndicator } from '@aragon/ui'
import MainView from './views/MainView'
import PresaleView from './views/PresaleView'
import CollateralError from './screens/CollateralError'
import { Presale } from './constants'

const App = () => {
  // *****************************
  // background script state
  // *****************************
  const { isReady, collateralsAreOk, presale } = useAppState()
  const isPresale = presale?.state !== Presale.state.CLOSED

  return (
    <div css="min-width: 320px">
      <Main assetsUrl="./">
        <SyncIndicator visible={!isReady} />
        {isPresale && isReady && collateralsAreOk && <PresaleView />}
        {!isPresale && isReady && collateralsAreOk && <MainView />}
        {isReady && !collateralsAreOk && <CollateralError />}
      </Main>
    </div>
  )
}

export default () => (
  <AragonApi reducer={appStateReducer}>
    <App />
  </AragonApi>
)
