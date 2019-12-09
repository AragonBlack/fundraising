import React, { useState } from 'react'
import { useAppState } from '@aragon/api-react'
import NoData from '../NoData'
import ChartWrapper from './ChartWrapper'
import PriceHistory from './PriceHistory'
import PriceVariation from './PriceVariation'

export default () => {
  // *****************************
  // context state
  // *****************************
  const { orders } = useAppState()

  // *****************************
  // internal state
  // *****************************
  const [activeChart, setActiveChart] = useState(0)

  return (
    <>
      {orders.length === 0 ? (
        <NoData message="No data to show." />
      ) : (
        <ChartWrapper>
          {activeChart === 0 && <PriceHistory activeChart={activeChart} setActiveChart={setActiveChart} />}
          {activeChart === 1 && <PriceVariation activeChart={activeChart} setActiveChart={setActiveChart} />}
        </ChartWrapper>
      )}
    </>
  )
}
