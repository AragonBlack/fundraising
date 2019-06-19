import { AragonApi } from '@aragon/api-react'
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import Main from './components/Main/Main'
// import RootPortal from './components/RootPortal/RootPortal'

ReactDOM.render(
  <AragonApi>
    <Main assetsUrl="./">
      <App />
    </Main>
  </AragonApi>,
  document.getElementById('root')
)
