import { AddressField, Badge, Table, TableCell, TableHeader, TableRow, Text, ContextMenu, ContextMenuItem, SafeLink, theme } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'

const orders = [
  { id: 1, date: '25/03/2019', type: 'buy', from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4', collateral: 'ANT', amount: 0.4, price: '200.33', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'},
  { id: 2, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'ANT', amount: 0.4, price: '4212.21', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'},
  { id: 3, date: '25/03/2019', type: 'sell', from: '0x88e4...', collateral: 'ETH', amount: 0.4, price: '2192.45', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'},
  { id: 4, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'ETH', amount: 0.4, price: '20.50', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'},
  { id: 5, date: '25/03/2019', type: 'sell', from: '0x88e4...', collateral: 'DAI', amount: 0.4, price: '330.50', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'},
  { id: 6, date: '25/03/2019', type: 'sell', from: '0x88e4...', collateral: 'ANT', amount: 0.4, price: '977.25', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'},
  { id: 7, date: '25/03/2019', type: 'buy', from: '0x88e4...', collateral: 'DAI', amount: 0.4, price: '0.50', txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005'}
]

export default class Orders extends React.Component {
  render() {
    const getOrderStyles = (order) => {
      let background, foreground, sign, type = ''
      if (order.type === 'buy') {
        background = theme.badgeAppBackground
        foreground = theme.Purple
        sign = '+'
        type = 'Buying order'
      } else {
        background = theme.infoPermissionsBackground
        foreground = 'rgb(218, 192, 139)'
        sign = '-'
        type = 'Selling order'
      }

      return { background, foreground, sign, type }
    }

    return (
      <div>
        <Title>
          <Text>Historical Orders</Text>
        </Title>
        <Table
          header={
            <TableRow>
              <TableHeader title="Date" />
              <TableHeader title="Order Type" />
              <TableHeader title="Address" />
              <TableHeader title="Amount" />
              <TableHeader title="Rate" />
            </TableRow>
          }
        >
          {orders.map((order) => {
            const orderStyle = getOrderStyles(order)
            return (
            <TableRow key={order.id}>
              <TableCell>
                <Text>{order.date}</Text>
              </TableCell>
              <TableCell>
                <Badge background={orderStyle.background} foreground={orderStyle.foreground}>
                  {orderStyle.type}
                </Badge>
              </TableCell>
              <TableCell>
                <AddressField address={order.from} />
              </TableCell>
              <TableCell>
                <Text>
                  {orderStyle.sign}
                  {order.amount + '  '}
                  {order.collateral}
                </Text>
              </TableCell>
              <TableCell>
                <Text>{'$' + order.price}</Text>
                <ContextMenu>
                  <SafeLink href={"https://etherscan.io/tx/" + order.txHash} target="_blank">
                    <ContextMenuItem>View Tx on Etherscan</ContextMenuItem>
                  </SafeLink>
                 </ContextMenu>
              </TableCell>
            </TableRow>
            )})
          }
        </Table>
      </div>
    )
  }
}

const Title = styled.h1`
  margin: 20px 0;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
`
