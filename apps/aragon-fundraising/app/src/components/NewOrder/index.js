import React, { useEffect, useContext, useState } from 'react'
import styled from 'styled-components'
import { TabBar } from '@aragon/ui'
import { MainViewContext } from '../../context'
import Order from './Order'

const NewOrder = () => {
  // get data from the react context
  const {
    order: { orderPanel },
  } = useContext(MainViewContext)

  const [screenIndex, setScreenIndex] = useState(0)

  // handle reset when opening
  useEffect(() => {
    if (orderPanel) {
      // reset to default values
      setScreenIndex(0)
    }
  }, [orderPanel])

  return (
    <div>
      <TabBarWrapper>
        <TabBar items={['Buy', 'Sell']} selected={screenIndex} onChange={setScreenIndex} />
      </TabBarWrapper>

      {screenIndex === 0 && <Order isBuyOrder />}
      {screenIndex === 1 && <Order />}
    </div>
  )
}

const TabBarWrapper = styled.div`
  margin: 0 -30px 30px;
`

export default NewOrder
