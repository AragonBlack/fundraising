import React, { useContext, useEffect, useState } from 'react'
import styled from 'styled-components'
import { useAppState } from '@aragon/api-react'
import { Box, Info, Text } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import subMonths from 'date-fns/subMonths'
import Chart from '../components/Chart'
import { formatBigNumber, toMonthlyAllocation } from '../utils/bn-utils'
import { MainViewContext } from '../context'

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    bondedToken: { address: tokenAddress, decimals: tokenDecimals, realSupply },
    collaterals: {
      dai: {
        address: daiAddress,
        decimals: daiDecimals,
        toBeClaimed,
        tap: { rate },
      },
    },
    batches,
    orders,
  } = useAppState()

  // *****************************
  // context state
  // *****************************
  const { reserveBalance, price } = useContext(MainViewContext)

  // *****************************
  // internal state
  // *****************************
  // the batch we use to compute trends
  const [trendBatch, setTrendBatch] = useState(null)

  // *****************************
  // effects
  // *****************************
  // update the base batch to compute trends
  useEffect(() => {
    // search the closest batch from (now - 1 month) to create some trends
    const oneMonthAgo = subMonths(new Date(), 1).getTime()
    const trendBatch = batches.reduce(
      (closest, b) => {
        const currentClosest = Math.abs(closest.timestamp - oneMonthAgo)
        const current = Math.abs(b.timestamp - oneMonthAgo)
        return currentClosest < current ? closest : b
      },
      { timestamp: new Date() }
    )
    setTrendBatch(trendBatch)
  }, [batches])

  // *****************************
  // human readable values
  // *****************************
  //
  // numbers
  const adjustedPrice = price ? formatBigNumber(price, 0, { numberPrefix: '$' }) : '...'
  const marketCap = price ? price.times(realSupply) : null
  const adjustedMarketCap = price && marketCap ? formatBigNumber(marketCap, daiDecimals, { numberPrefix: '$' }) : '...'
  const tradingVolume = orders
    // only keep DAI orders
    .filter(o => o.collateral === daiAddress)
    // keep values
    .map(o => o.value)
    // sum them and tada, you got the trading volume
    .reduce((acc, current) => acc.plus(current), new BigNumber(0))
  const adjsutedTradingVolume = formatBigNumber(tradingVolume, daiDecimals, { numberPrefix: '$' })
  const adjustedTokenSupply = formatBigNumber(realSupply, tokenDecimals)
  const realReserve = reserveBalance ? reserveBalance.minus(toBeClaimed) : null
  const adjustedReserves = realReserve ? formatBigNumber(realReserve, daiDecimals, { numberPrefix: '$' }) : '...'
  const adjustedMonthlyAllowance = formatBigNumber(toMonthlyAllocation(rate, daiDecimals), daiDecimals, { numberPrefix: '$' })
  const adjustedYearlyAllowance = formatBigNumber(toMonthlyAllocation(rate, daiDecimals).times(12), daiDecimals, { numberPrefix: '$' })
  //
  // trends
  const adjustedPriceTrend =
    price && trendBatch?.startPrice ? formatBigNumber(price.minus(trendBatch.startPrice), 0, { keepSign: true, numberPrefix: '$' }) : null
  // if startPrice is here, realSupply too, since NewMetaBatch event occurs before NewBatch one
  const marketCapDiff = marketCap && trendBatch?.startPrice ? marketCap.minus(trendBatch.startPrice.times(trendBatch.realSupply)) : null
  const adjustedMarketCapTrend = marketCapDiff ? formatBigNumber(marketCapDiff, daiDecimals, { keepSign: true, numberPrefix: '$' }) : null
  const tradingTrendVolume = trendBatch?.id
    ? orders
        // only keep DAI orders since the start of the trendBatch
        .filter(o => o.collateral === daiAddress && o.batchId >= trendBatch.id)
        // keep values
        .map(o => o.value)
        // sum them and tada, you got the trading volume between now and the beginning of the trendBatch
        .reduce((acc, current) => acc.plus(current), new BigNumber(0))
    : null
  const adjsutedTradingVolumeTrend = tradingTrendVolume ? formatBigNumber(tradingTrendVolume, daiDecimals, { keepSign: true, numberPrefix: '$' }) : null
  const adjustedTokenSupplyTrend = trendBatch?.realSupply ? formatBigNumber(realSupply.minus(trendBatch.realSupply), tokenDecimals, { keepSign: true }) : null
  const adjustedReservesTrend =
    reserveBalance && trendBatch?.realBalance
      ? formatBigNumber(realReserve.minus(trendBatch.realBalance), tokenDecimals, { keepSign: true, numberPrefix: '$' })
      : null
  // helper to compute the trend color (green if positive, red if negative)
  const getTrendColor = value => (value ? (value.startsWith('+') ? 'green' : 'red') : 'none')

  return (
    <div>
      <KeyMetrics
        heading={<span css="margin-left: 1rem;font-size: 12px;font-weight: 600;text-transform: uppercase;color: #637381;">Key Metrics</span>}
        padding={false}
      >
        <ul>
          <li>
            <div>
              <p className="title">Price</p>
              <p className="number">{adjustedPrice}</p>
            </div>
            <p className={`sub-number ${getTrendColor(adjustedPriceTrend)}`}>{adjustedPriceTrend} (M)</p>
          </li>
          <li>
            <div>
              <p className="title">Market Cap</p>
              <p className="number">{adjustedMarketCap}</p>
            </div>
            <p className={`sub-number ${getTrendColor(adjustedMarketCapTrend)}`}>{adjustedMarketCapTrend} (M)</p>
          </li>
          <li>
            <div>
              <p className="title">Trading Volume</p>
              <p className="number">{adjsutedTradingVolume}</p>
            </div>
            <p className={`sub-number ${getTrendColor(adjsutedTradingVolumeTrend)}`}>{adjsutedTradingVolumeTrend} (M)</p>
          </li>
          <li>
            <div>
              <p className="title">Token Supply</p>
              <p className="number">{adjustedTokenSupply}</p>
            </div>
            <p className={`sub-number ${getTrendColor(adjustedTokenSupplyTrend)}`}>{adjustedTokenSupplyTrend} (M)</p>
          </li>
          <li>
            <div>
              <p className="title">Reserves</p>
              <p className="number">{adjustedReserves}</p>
            </div>
            <p className={`sub-number ${getTrendColor(adjustedReservesTrend)}`}>{adjustedReservesTrend} (M)</p>
          </li>
          <li>
            <div>
              <p className="title">Monthly Allowance</p>
              <p className="number">{adjustedMonthlyAllowance}</p>
            </div>
            <p className="sub-number green">{adjustedYearlyAllowance} (Y)</p>
          </li>
        </ul>
        <Info css="margin: 1rem; margin-top: 0; width: auto; display: inline-block;">
          <Text>Token address: {tokenAddress}</Text>
        </Info>
      </KeyMetrics>
      <Chart />
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

  .none {
    visibility: hidden;
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
