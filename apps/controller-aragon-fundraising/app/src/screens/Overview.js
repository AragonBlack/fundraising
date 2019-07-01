import BN from 'bignumber.js'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import Chart from '../components/Chart'
import Box from '../components/Box/Box'

const CONVERT_API_BASE = 'https://min-api.cryptocompare.com/data'

const convertApiUrl = symbols => `${CONVERT_API_BASE}/price?fsym=USD&tsyms=${symbols.join(',')}`

const formatCollateral = amount => new BN(amount).toFormat(0)

const convertToUSD = (collateral, rate) => new BN(collateral).div(new BN(rate)).toFormat(2)

export default () => {
  const [state, setState] = useState({
    daiCollateral: 103039,
    antCollateral: 60421,
    daiRate: 0,
    antRate: 0,
  })
  const { daiCollateral, daiRate, antCollateral, antRate } = state
  useEffect(() => {
    async function getRates() {
      const res = await fetch(convertApiUrl(['DAI', 'ANT']))
      const rates = await res.json()
      setState({ ...state, daiRate: rates['DAI'], antRate: rates['ANT'] })
    }
    getRates()

    const id = setInterval(getRates, 10000)
    return () => clearInterval(id)
  }, [])
  return (
    <ContentWrapper>
      <KeyMetrics heading="Key metrics" padding={false}>
        <ul>
          <li>
            <div>
              <p className="title">Price</p>
              <p className="number">$106,03.36</p>
            </div>
            <p className="sub-number green">+$4.82 (0.5%)</p>
          </li>
          <li>
            <div>
              <p className="title">Market Cap</p>
              <p className="number">$675,02 M</p>
            </div>
            <p className="sub-number green">+$4.82M</p>
          </li>
          <li>
            <div>
              <p className="title">Trading Volume</p>
              <p className="number">$1.5 M</p>
            </div>
            <p className="sub-number green">$48M (Y)</p>
          </li>
          <li>
            <div>
              <p className="title">Token Supply</p>
              <p className="number">100,013 M</p>
            </div>
            <p className="sub-number red">-$23.82 (0.5%)</p>
          </li>
          <li>
            <div>
              <p className="title">Reserves</p>
              <p className="number">$25,07 M</p>
            </div>
            <p className="sub-number red">-$0.82M</p>
          </li>
          <li>
            <div>
              <p className="title">Monthly Allowance</p>
              <p className="number">$150.5 K</p>
            </div>
            <p className="sub-number green">$48M (Y)</p>
          </li>
        </ul>
      </KeyMetrics>
      <Chart />
    </ContentWrapper>
  )
}

const ContentWrapper = styled.div`
  margin: 1rem 0;
  @media only screen and (max-width: 768px) {
    margin: 1rem;
  }
  @media only screen and (max-width: 700px) {
    padding: 0;
  }
`

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
