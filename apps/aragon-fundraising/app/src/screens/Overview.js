import React from 'react'
import styled from 'styled-components'
import { Box, Info, Text } from '@aragon/ui'
import BN from 'bn.js'
import Chart from '../components/Chart'
import { round, toMonthlyAllocation } from '../lib/math-utils'
import { formatTokenAmount } from '../lib/utils'

export default ({
  overview,
  price,
  orders,
  bondedToken: { address: tokenAddress, decimals: tokenDecimals, totalSupply, tokensToBeMinted, realSupply },
  currentBatch,
  collateralTokens: [{ address: daiAddress, decimals: daiDecimals, collateralsToBeClaimed, virtualSupply }],
  polledData: { polledDaiBalance, polledBatchId, polledReserveBalance },
}) => {
  const {
    tap: { allocation },
    batches,
  } = overview

  // human readable values
  //  TODO: review all of this...
  console.log('TOTAL SUPPLY')
  console.log(totalSupply)
  console.log('TokensToBeMinted')
  console.log(tokensToBeMinted)
  console.log('collateralsToBeClaimed')
  console.log(collateralsToBeClaimed)

  const tokenSupply = new BN(totalSupply).add(new BN(tokensToBeMinted))
  const adjustedTokenSupply = formatTokenAmount(tokenSupply.toString(), false, tokenDecimals, false, {
    rounding: 2,
  })
  const adjustedReserves = polledReserveBalance
    ? formatTokenAmount(polledReserveBalance.sub(new BN(collateralsToBeClaimed)).toString(), false, daiDecimals, false, { rounding: 2 })
    : '...'
  const adjustedMonthlyAllowance = round(toMonthlyAllocation(allocation.toString(), daiDecimals))
  const marketCap = price ? new BN(parseInt(price * 100).toString()).mul(new BN(totalSupply).add(new BN(tokensToBeMinted))) : '...'
  const truncatedMarketCap = marketCap.toString().substr(0, marketCap.toString().length - 2)
  const adjustedMarketCap = price ? formatTokenAmount(truncatedMarketCap, false, daiDecimals, false, { rounding: 2 }) : '...'

  const adjustedPrice = price || '...'

  const tradingVolume = orders
    // only keep DAI orders
    .filter(o => o.collateral === daiAddress)
    // transform amounts in BN
    .map(o => {
      if (o.type === 'SELL') {
        // console.log(new BN(parseInt(o.tokens)).toString())
        // return new BN(parseInt(o.tokens))
        return o.tokens
      } else {
        return new BN(o.amount)
      }
    })
    // sum them and tada, you got the trading volume
    .reduce((acc, current) => acc.add(current), new BN('0'))
  const adjsutedTradingVolume = formatTokenAmount(tradingVolume.toString(), false, daiDecimals, false, { rounding: 2 })

  // let price
  // if (polledBatchId && polledBatchId > currentBatch) {
  //   // last batch is over, next batch will start with the last price of the last batch
  //   // TODO: take buyPrice or sellPrice ?? change the following
  //   price = startPrice
  // } else price = startPrice

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
              <p className="number">${adjustedPrice}</p>
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
              <p className="number">{adjsutedTradingVolume}</p>
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
          <Text>Token address: {tokenAddress}</Text>
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
