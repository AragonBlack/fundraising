import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { TabBar } from '@aragon/ui'

import Order from './Order'

const NewOrder = ({ opened, collaterals, bondedToken, price, onOrder }) => {
  const [screenIndex, setScreenIndex] = useState(0)

  // handle reset when opening
  useEffect(() => {
    if (opened) {
      // reset to default values
      setScreenIndex(0)
    }
  }, [opened])

  return (
    <div>
      <TabBarWrapper>
        <TabBar items={['Buy', 'Sell']} selected={screenIndex} onChange={setScreenIndex} />
      </TabBarWrapper>

      {screenIndex === 0 && <Order opened={opened} isBuyOrder collaterals={collaterals} bondedToken={bondedToken} price={price} onOrder={onOrder} />}
      {screenIndex === 1 && <Order opened={opened} collaterals={collaterals} bondedToken={bondedToken} price={price} onOrder={onOrder} />}
    </div>
  )
}

const TabBarWrapper = styled.div`
  margin: 0 -30px 30px;
`

export default NewOrder
