import React, { useState } from 'react'
import { useAppState } from '@aragon/api-react'
import { useTheme } from '@aragon/ui'
import NoData from '../NoData'
import ChartWrapper from './ChartWrapper'
import PriceHistory from './PriceHistory'
import PriceVariation from './PriceVariation'

export default () => {
  const theme = useTheme()
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
        <ChartWrapper theme={theme}>
          {activeChart === 0 && <PriceHistory theme={theme} activeChart={activeChart} setActiveChart={setActiveChart} />}
          {activeChart === 1 && <PriceVariation theme={theme} activeChart={activeChart} setActiveChart={setActiveChart} />}
        </ChartWrapper>
      )}
    </>
  )
}
