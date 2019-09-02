import React, { useContext } from 'react'
import styled from 'styled-components'
import { useAppState } from '@aragon/api-react'
import { Box, Info, Text } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import Chart from '../components/Chart'
import { formatBigNumber, toMonthlyAllocation } from '../utils/bn-utils'
import { MainViewContext } from '../context'

export default () => {
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
    orders,
  } = useAppState()

  // get polled data from the react context
  const {
    polledData: { reserveBalance, price },
  } = useContext(MainViewContext)

  // human readable values
  const adjustedTokenSupply = formatBigNumber(realSupply, tokenDecimals)
  const adjustedReserves = reserveBalance ? formatBigNumber(reserveBalance.minus(toBeClaimed), daiDecimals) : '...'
  const adjustedMonthlyAllowance = formatBigNumber(toMonthlyAllocation(rate, daiDecimals), daiDecimals)
  const adjustedMarketCap = price ? formatBigNumber(price.mul(realSupply), daiDecimals) : '...'
  const adjustedPrice = price ? formatBigNumber(price, daiDecimals) : '...'
  const tradingVolume = orders
    // only keep DAI orders
    .filter(o => o.collateral === daiAddress)
    // keep amounts
    .map(o => o.amount)
    // sum them and tada, you got the trading volume
    .reduce((acc, current) => acc.plus(current), new BigNumber(0))
  const adjsutedTradingVolume = formatBigNumber(tradingVolume, daiDecimals)

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
              <p className="number">${adjsutedTradingVolume}</p>
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
