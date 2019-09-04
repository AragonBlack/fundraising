import React, { useState } from 'react'
import { Layout, Button } from '@aragon/ui'
import Presale from '../screens/Presale'
import AppHeader from '../components/AppHeader'
import PresaleSidePanel from '../components/PresaleSidePanel'

export default () => {
  // *****************************
  // internal state
  // *****************************
  const [orderPanel, setOrderPanel] = useState(false)
  const state = 'default'

  return (
    <>
      <Layout>
        <AppHeader
          heading="Fundraising Presale"
          action1={
            <Button disabled={state !== 'default'} mode="strong" label="Buy Presale Tokens" onClick={() => setOrderPanel(true)}>
              Buy Presale Tokens
            </Button>
          }
        />
        <Presale state={state} />
      </Layout>
      <PresaleSidePanel price={300.0} opened={orderPanel} onClose={() => setOrderPanel(false)} />
    </>
  )
}
