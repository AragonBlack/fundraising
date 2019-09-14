import React, { useEffect, useContext, useState } from 'react'
import styled from 'styled-components'
import { SidePanel, TabBar } from '@aragon/ui'
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
      <TabBarWrapper>
        <TabBar items={['Buy', 'Sell']} selected={screenIndex} onChange={setScreenIndex} />
      </TabBarWrapper>

      {screenIndex === 0 && <Order isBuyOrder />}
      {screenIndex === 1 && <Order />}
    </SidePanel>
  )
}

const TabBarWrapper = styled.div`
  margin: 0 -30px 0;
`

export default NewOrder
