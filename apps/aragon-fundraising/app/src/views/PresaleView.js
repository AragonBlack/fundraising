import React, { useState } from 'react'
import { Header, Layout, Button } from '@aragon/ui'
import Presale from '../screens/Presale'
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
        <Header
          primary="Fundraising Presale"
          secondary={
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
