import { Text } from '@aragon/ui'
import BN from 'bignumber.js'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import antImage from '../assets/ant.png'
import daiImage from '../assets/dai.png'
import Chart from '../components/Chart'

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
      <TokenBalances>
        <h1 className="title">
          <Text>Token balances</Text>
        </h1>
        <ul>
          <li>
            <p className="title">Bonded token supply</p>
            <p className="number">210</p>
            <p className="sub-number">$185,220</p>
          </li>
          <li>
            <div className="title">
              <img src={daiImage} />
              <p>DAI Collateral</p>
            </div>
            <p className="number">{formatCollateral(daiCollateral)}</p>
            <p className="sub-number">$103,039</p>
          </li>
          <li>
            <div className="title">
              <img src={antImage} />
              <p>ANT Collateral</p>
            </div>
            <p className="number">{formatCollateral(antCollateral)}</p>
            <p className="sub-number">$82,181</p>
          </li>
          <li>
            <p className="title">Total balance USD</p>
            <p className="number">$185,220</p>
            <p className="sub-number">210 bonded tokens</p>
          </li>
          <li>
            <p className="title">Tap rate</p>
            <p className="number">$18,522</p>
            <p className="sub-number">10%</p>
          </li>
        </ul>
      </TokenBalances>
      <Chart />
    </ContentWrapper>
  )
}

const ContentWrapper = styled.div`
  padding: 2rem;

  @media only screen and (max-width: 700px) {
    padding: 0;
  }
`

const TokenBalances = styled.div`
  margin-bottom: 2rem;

  .title {
    margin-bottom: 1rem;
    font-weight: 600;
  }

  ul {
    display: flex;
    justify-content: space-between;
    padding: 2rem;
    background: #fff;
    border: 1px solid rgba(209, 209, 209, 0.5);
    box-sizing: border-box;
    border-radius: 3px;
    box-shadow: 0px 6px 14px rgba(0, 0, 0, 0.06);
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
      font-weight: 600;
      color: #6d777b;
      text-transform: uppercase;
      opacity: 0.7;
      white-space: nowrap;
    }

    .number {
      margin: 0.75rem 0;
      font-size: 32px;
      line-height: 24px;
    }

    .sub-number {
      color: #b5b5b5;
    }
  }

  @media only screen and (max-width: 1000px) {
    ul {
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    li {
      padding: 2rem;
      border-bottom: 1px solid rgba(209, 209, 209, 0.5);
    }
  }

  @media only screen and (max-width: 700px) {
    .title {
      margin: 1.5rem;
    }

    li .title {
      margin-left: 0;
    }
  }
`
