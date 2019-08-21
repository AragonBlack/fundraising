import React from 'react'
import styled from 'styled-components'
import { Box } from '@aragon/ui'
import BN from 'bn.js'
import Chart from '../components/Chart'
import { round } from '../lib/math-utils'

export default ({ overview, bondedToken, currentBatch, polledData: { polledTotalSupply, polledBatchId } }) => {
  const {
    reserve,
    tap: { allocation },
    batches,
  } = overview
  const startPrice = 1
  const marketCap = round(startPrice * (polledTotalSupply || bondedToken.totalSupply), 3)
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
              <p className="number">${marketCap}</p>
            </div>
            {/* <p className="sub-number green">+$4.82M</p> */}
          </li>
          <li>
            <div>
              <p className="title">Trading Volume</p>
              <p className="number">$1.5 M</p>
            </div>
            {/* <p className="sub-number green">$48M (Y)</p> */}
          </li>
          <li>
            <div>
              <p className="title">Token Supply</p>
              <p className="number">{round(polledTotalSupply || bondedToken.totalSupply, 3)}</p>
            </div>
            {/* <p className="sub-number red">-$23.82 (0.5%)</p> */}
          </li>
          <li>
            <div>
              <p className="title">Reserves</p>
              <p className="number">{reserve}</p>
            </div>
            {/* <p className="sub-number red">-$0.82M</p> */}
          </li>
          <li>
            <div>
              <p className="title">Monthly Allowance</p>
              <p className="number">{allocation}</p>
            </div>
            {/* <p className="sub-number green">$48M (Y)</p> */}
          </li>
        </ul>
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
