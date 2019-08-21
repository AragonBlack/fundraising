import React from 'react'
import { AragonApi } from '@aragon/api-react'
import appStateReducer from './app-state-reducer'

export const AppLogicProvider = ({ children }) => {
  return <AragonApi reducer={appStateReducer}>{children}</AragonApi>
}
