import React from 'react'
import { AragonApi, useAppState } from '@aragon/api-react'
import appStateReducer from './app-state-reducer'

// handles the main logic of the app.
export const useAppLogic = () => {
  const state = useAppState()

  return {
    // background script state
    ...state,
  }
}

export const AppLogicProvider = ({ children }) => {
  return <AragonApi reducer={appStateReducer}>{children}</AragonApi>
}
