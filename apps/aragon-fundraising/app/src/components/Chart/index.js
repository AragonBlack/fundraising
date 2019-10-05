import React, { useState } from 'react'
import { Box, GU } from '@aragon/ui'
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

  .navbar {
    display: flex;
    justify-content: space-between;
    margin-top: ${4 * GU}px;
    margin-right: ${6 * GU}px;
    margin-left: ${8 * GU}px;

    .timeline {
      display: flex;
      justify-content: space-between;
      width: 100%;

      &:nth-child(1) {
        display: flex;
        align-items: center;
        font-weight: bold;
        font-size: 16px;
      }

      .item {
        margin-right: ${3 * GU}px;
        color: rgba(109, 119, 123, 0.7);
      }
      .item:last-child {
        margin-right: ${4 * GU}px;
      }

      .item:hover {
        cursor: pointer;
        border-bottom: 2px solid #08bee5;
      }
      .item.active {
        border-bottom: 2px solid #08bee5;
      }

      .item > span:nth-child(1) {
        margin-right: ${0.5 * GU}px;
        color: black;
        margin-right: 0.25rem;
      }

    .chart-view {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    .chart-view-text {
      font-size: 16px;
      color: #637381;
      margin-right: ${2 * GU}px;
      white-space: nowrap;
    }
  }

  @media only screen and (max-width: 1152px) {
    .navbar {
      flex-direction: column-reverse;
      align-items: flex-end;

      .timeline {
        margin-top: ${4 * GU}px;
      }
    }
  }

  @media only screen and (max-width: 700px) {
    .timeline {
      flex-direction: column-reverse;

      & > div:nth-child(1) {
        margin-top: ${4 * GU}px;
      }
      .item:last-child {
        margin-right: 0;
      }
    }
  }
`
