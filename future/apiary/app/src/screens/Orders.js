import { AddressField, Badge, Table, TableCell, TableHeader, TableRow, Text, Viewport } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'
import Box from '../components/Box'
import LocalIdentityBadge from '../components/LocalIdentityBadge'

const orders = [
  { id: 1, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'ANT', amount: 0.4, value: 0.8, price: '0.5' },
  { id: 2, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'ANT', amount: 0.4, value: 0.8, price: '0.5' },
  { id: 3, date: '25/03/2019', type: 'sell', from: '0x88e4...', collateral: 'ETH', amount: 0.4, value: 0.8, price: '0.5' },
  { id: 4, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'ETH', amount: 0.4, value: 0.8, price: '0.5' },
  { id: 5, date: '25/03/2019', type: 'sell', from: '0x88e4...', collateral: 'DAI', amount: 0.4, value: 0.8, price: '0.5' },
  { id: 6, date: '25/03/2019', type: 'sell', from: '0x88e4...', collateral: 'ANT', amount: 0.4, value: 0.8, price: '0.5' },
  { id: 7, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'DAI', amount: 0.4, value: 0.8, price: '0.5' },
]

export default class Repositories extends React.Component {
  render() {
    // const { repositories } = this.props

    return (
      <div>
        <Title>
          <Text>Orders</Text>
        </Title>
        <Table
          header={
            <TableRow>
              <TableHeader title="Date" />
              <TableHeader title="Type" />
              <TableHeader title="Source / recipient" />
              <TableHeader title="Amount" />
              <TableHeader title="Collateral" />
              <TableHeader title="Price" />
            </TableRow>
          }
        >
          {orders.map(order => (
            <TableRow key={order.id}>
              <TableCell>
                <Text>{order.date}</Text>
              </TableCell>
              <TableCell>
                <Text color={order.type === 'buy' ? '#21d48e' : '#fb7777'}>{order.type}</Text>
              </TableCell>
              <TableCell>
                <Badge.Identity>{order.from}</Badge.Identity>
              </TableCell>

              <TableCell>
                <Text color={order.type === 'buy' ? '#21d48e' : '#fb7777'}>
                  {order.type === 'buy' ? '+' : '-'}
                  {order.amount} BND
                </Text>
              </TableCell>
              <TableCell>
                <Text>{order.value}</Text>
              </TableCell>
              <TableCell>
                <Text>
                  {order.price} {order.collateral} / BND
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>
    )
  }
}

const Title = styled.h1`
  margin: 20px 20px 10px 20px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
`
