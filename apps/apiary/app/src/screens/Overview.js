import { Table, TableCell, TableRow, Text } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'
import antImage from '../assets/ant.png'
import ethImage from '../assets/eth.png'
import Chart from '../components/Chart'

export default class Repositories extends React.Component {
  render() {
    return (
      <div>
        <TokenBalances>
          <h1 className="title">
            <Text>Token balances</Text>
          </h1>
          <Table>
            <TableRow>
              <TableCell>
                <div className="cell-content">
                  <p className="title">Bonded token supply</p>
                  <p className="number">5600</p>
                  <p className="sub-number">$123,600,923.82</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="cell-content">
                  <div className="title">
                    <img src={ethImage} />
                    <p>ETH Collateral</p>
                  </div>
                  <p className="number">103,039.39</p>
                  <p className="sub-number">$76,600,923.82</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="cell-content">
                  <div className="title">
                    <img src={antImage} />
                    <p>ANT Collateral</p>
                  </div>
                  <p className="number">2,934.45</p>
                  <p className="sub-number">$17,586.27</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="cell-content">
                  <p className="title">Total balance USD</p>
                  <p className="number">$23,699,746.32</p>
                  <p className="sub-number">$123,600,923.82</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="cell-content">
                  <p className="title">Tap rate</p>
                  <p className="number">11,340</p>
                  <p className="sub-number">$25,500.82</p>
                </div>
              </TableCell>
            </TableRow>
          </Table>
        </TokenBalances>
        <Chart />
      </div>
    )
  }
}

const TokenBalances = styled.div`
  margin-bottom: 2rem;

  table {
    box-shadow: 0px 6px 14px rgba(0, 0, 0, 0.06);
  }

  .title {
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .cell-content {
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
`
