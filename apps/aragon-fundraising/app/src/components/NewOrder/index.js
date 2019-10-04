import React, { useEffect, useContext, useState } from 'react'
import styled from 'styled-components'
import { SidePanel, Tabs, GU } from '@aragon/ui'
import { MainViewContext } from '../../context'
import Order from './Order'

const NewOrder = () => {
  // *****************************
  // context state
  // *****************************
  const { orderPanel, setOrderPanel } = useContext(MainViewContext)

  // *****************************
  // internal state
  // *****************************
  const [screenIndex, setScreenIndex] = useState(0)

  // *****************************
  // effects
  // *****************************
  // handle reset when opening
  useEffect(() => {
    if (orderPanel) {
      // reset to default values
      setScreenIndex(0)
    }
  }, [orderPanel])

  return (
    <SidePanel opened={orderPanel} onClose={() => setOrderPanel(false)} title="New Order">
      <div
        css={`
          margin: 0 -${3 * GU}px;
        `}
      >
        <Tabs items={['Buy', 'Sell']} selected={screenIndex} onChange={setScreenIndex} />
      </div>

      {screenIndex === 0 && <Order isBuyOrder />}
      {screenIndex === 1 && <Order />}
    </SidePanel>
  )
}

export default NewOrder
