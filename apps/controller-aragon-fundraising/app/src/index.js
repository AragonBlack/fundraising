import { AragonApi } from '@aragon/api-react'
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

ReactDOM.render(
  <AragonApi>
    <App />
  </AragonApi>,
  document.getElementById('root')
)
