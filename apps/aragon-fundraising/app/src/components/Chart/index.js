import React, { useState } from 'react'
import { useAppState } from '@aragon/api-react'
import { Box } from '@aragon/ui'
import styled from 'styled-components'
import NoData from '../NoData'
import PriceLine from './PriceLine'

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
          {activeChart === 2 && <PriceLine activeChart={activeChart} setActiveChart={setActiveChart} />}
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
    margin: 0 3rem;

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
        margin-right: 1.5rem;
      }

      .item:hover {
        cursor: pointer;
        border-bottom: 2px solid #08bee5;
      }
      .item.active {
        border-bottom: 2px solid #08bee5;
      }

      .item > span {
        color: black;
        margin-right: 0.25rem;
      }

      .item > span:last-child {
        color: rgba(109, 119, 123, 0.7);
        margin-right: 0;
      }
    }
  }

  @media only screen and (max-width: 1152px) {
    .navbar {
      flex-direction: column-reverse;
      align-items: flex-end;

      .timeline {
        margin-top: 2rem;
      }
    }
  }

  @media only screen and (max-width: 700px) {
    .timeline {
      flex-direction: column-reverse;

      & > div:nth-child(1) {
        margin-top: 2rem;
        justify-content: flex-end;
      }
      .item:last-child {
        margin-right: 0;
      }
    }
  }
`
