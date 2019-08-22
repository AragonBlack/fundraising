import React from 'react'
import styled from 'styled-components'
import { Box, Info, Text } from '@aragon/ui'
import Chart from '../components/Chart'
import { round, toMonthlyAllocation } from '../lib/math-utils'
import { formatTokenAmount } from '../lib/utils'

export default ({ overview, bondedToken, currentBatch, collateralTokens: [{ decimals }], polledData: { polledTotalSupply, polledBatchId } }) => {
  const {
    reserve,
    tap: { allocation },
    batches,
  } = overview

  const startPrice = 1
  // human readable values
  const adjustedTokenSupply = formatTokenAmount(polledTotalSupply || bondedToken.totalSupply, false, bondedToken.decimals, false, { rounding: 2 })
  const adjustedReserves = formatTokenAmount(reserve, false, decimals, false, { rounding: 2 })
  const adjustedMonthlyAllowance = round(toMonthlyAllocation(allocation.toString(), decimals))
  // TODO: use big number ?
  const marketCap = startPrice * (polledTotalSupply || bondedToken.totalSupply)
  const adjustedMarketCap = formatTokenAmount(marketCap, false, bondedToken.decimals, false, { rounding: 2 })

  let price
  if (polledBatchId && polledBatchId > currentBatch) {
    // last batch is over, next batch will start with the last price of the last batch
    // TODO: take buyPrice or sellPrice ?? change the following
    price = startPrice
  } else price = startPrice
  return (
    <div>
      <KeyMetrics
        heading={<h1 css="margin-left: 1rem;font-size: 12px;font-weight: 600;text-transform: uppercase;color: #637381;">Key Metrics</h1>}
        padding={false}
      >
        <ul>
          <li>
            <div>
              <p className="title">Price</p>
              <p className="number">${round(price, 3)}</p>
            </div>
            {/* <p className="sub-number green">+$4.82 (0.5%)</p> */}
          </li>
          <li>
            <div>
              <p className="title">Market Cap</p>
              <p className="number">${adjustedMarketCap}</p>
            </div>
            {/* <p className="sub-number green">+$4.82M</p> */}
          </li>
          <li>
            <div>
              <p className="title">Trading Volume</p>
              {/* TODO: handle trading volume */}
              <p className="number">$1.5 M</p>
            </div>
            {/* <p className="sub-number green">$48M (Y)</p> */}
          </li>
          <li>
            <div>
              <p className="title">Token Supply</p>
              <p className="number">{adjustedTokenSupply}</p>
            </div>
            {/* <p className="sub-number red">-$23.82 (0.5%)</p> */}
          </li>
          <li>
            <div>
              <p className="title">Reserves</p>
              <p className="number">${adjustedReserves}</p>
            </div>
            {/* <p className="sub-number red">-$0.82M</p> */}
          </li>
          <li>
            <div>
              <p className="title">Monthly Allowance</p>
              <p className="number">${adjustedMonthlyAllowance}</p>
            </div>
            {/* <p className="sub-number green">$48M (Y)</p> */}
          </li>
        </ul>
        <Info css="margin: 1rem; margin-top: 0; width: auto; display: inline-block;">
          <Text>Token address: {bondedToken.address}</Text>
        </Info>
      </KeyMetrics>
      <Chart batches={batches || []} />
    </div>
  )
}

const KeyMetrics = styled(Box)`
  margin-bottom: 1rem;

  .green {
    color: #2cc68f;
  }

  .red {
    color: #fb7777;
  }

  .title {
    margin-bottom: 1rem;
    font-weight: 600;
  }

  ul {
    display: flex;
    justify-content: space-between;
    background: #fff;
    box-sizing: border-box;
    border-radius: 3px;
    padding: 1rem;
  }

  li {
    list-style-type: none;

    img {
      display: inline-block;
      height: 16px;
      margin-right: 0.5rem;
    }

    .title {
      display: flex;
      font-size: 16px;
      font-weight: 300;
      color: #637381;
      white-space: nowrap;
      margin-bottom: 0.75rem;
    }

    .number {
      margin-bottom: 1rem;
      font-size: 26px;
      line-height: 24px;
    }

    .sub-number {
      font-size: 16px;
    }
  }

  @media only screen and (max-width: 1152px) {
    ul {
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid #dde4e9;

      .number {
        margin-bottom: 0;
      }
    }

    li:last-child {
      border-bottom: none;
    }
  }
`
