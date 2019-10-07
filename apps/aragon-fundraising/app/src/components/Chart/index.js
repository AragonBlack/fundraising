import React, { useState } from 'react'
import { Box } from '@aragon/ui'
import { useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import NoData from '../NoData'
import PriceLine from './PriceLine'
import PriceSticks from './PriceSticks'

export default () => {
  const { orders } = useAppState()
  const [activeChart, setActiveChart] = useState(2)
  return (
    <>
      {orders.length === 0 ? (
        <NoData message="No data to show." />
      ) : (
        <Chart>
          {activeChart === 0 && <PriceLine activeChart={activeChart} setActiveChart={setActiveChart} />}
          {activeChart === 1 && <PriceLine activeChart={activeChart} setActiveChart={setActiveChart} />}
          {activeChart === 2 && <PriceSticks activeChart={activeChart} setActiveChart={setActiveChart} />}
        </Chart>
      )}
    </>
  )
}

const Chart = styled(Box)`
  box-sizing: border-box;
  display: flex;
  justify-content: center;

  @media only screen and (max-width: 700px) {
    & > div {
      width: 100%;
    }
  }
`
