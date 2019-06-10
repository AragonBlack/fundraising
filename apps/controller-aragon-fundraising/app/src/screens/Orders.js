import {
  Badge,
  ContextMenu,
  ContextMenuItem,
  DropDown,
  IdentityBadge,
  SafeLink,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Text,
  theme,
  unselectable,
  Viewport,
} from '@aragon/ui'
import BN from 'bignumber.js'
import { format } from 'date-fns'
import React, { useState } from 'react'
import styled from 'styled-components'
import DateRangeInput from '../components/DateRange/DateRangeInput'
import ToggleFiltersButton from '../components/ToggleFiltersButton'

const orders = [
  {
    id: 1,
    date: '25/03/2019',
    type: 'buy',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'ANT',
    amount: 0.4,
    price: '200.33',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Pending',
  },
  {
    id: 2,
    date: '25/03/2019',
    type: 'buy',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'ANT',
    amount: 0.4,
    price: '4212.21',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Cleared',
  },
  {
    id: 3,
    date: '25/03/2019',
    type: 'sell',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'ETH',
    amount: 0.4,
    price: '2192.45',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Returned',
  },
  {
    id: 4,
    date: '25/03/2019',
    type: 'buy',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'ETH',
    amount: 0.4,
    price: '20.50',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Returned',
  },
  {
    id: 5,
    date: '25/03/2019',
    type: 'sell',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'DAI',
    amount: 0.4,
    price: '330.50',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Returned',
  },
  {
    id: 6,
    date: '25/03/2019',
    type: 'sell',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'ANT',
    amount: 0.4,
    price: '977.25',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Returned',
  },
  {
    id: 7,
    date: '25/03/2019',
    type: 'buy',
    from: '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4',
    collateral: 'DAI',
    amount: 0.4,
    price: '0.50',
    txHash: '0xbd0a2fcb1143f1bb2c195965a776840240698bfe163f200173f9dc6b18211005',
    state: 'Returned',
  },
].map((order, idx) => {
  order.date = {
    value: new Date().getTime() + idx * 10000000,
    text: format(new Date().getTime() + idx * 10000000, 'MM/dd/yyyy - HH:mm', { awareOfUnicodeTokens: true }),
  }

  return order
})

const filter = (orders, state) => {
  const keys = Object.keys(state)

  return orders
    .filter(order => {
      for (let idx = 0; idx < keys.length; idx++) {
        const type = keys[idx]
        const filter = state[type]

        if (type === 'order' && filter.payload[filter.active] !== 'All') {
          if (filter.payload[filter.active].toLowerCase() !== order.type.toLowerCase()) {
            return false
          }
        }

        if (type === 'token' && filter.payload[filter.active] !== 'All') {
          if (filter.payload[filter.active].toLowerCase() !== order.collateral.toLowerCase()) {
            return false
          }
        }

        if (type === 'holder' && filter.payload[filter.active] !== 'All') {
          if (filter.payload[filter.active].toLowerCase() !== order.from.toLowerCase()) {
            return false
          }
        }

        if (type === 'date') {
          if (filter.payload.start > order.date.value || filter.payload.end < order.date.value) {
            return false
          }
        }
      }
      return true
    })
    .sort((a, b) => {
      if (state.price.payload[state.price.active] === 'Ascending') {
        return BN(a.price)
          .minus(BN(b.price))
          .toNumber()
      } else if (state.price.payload[state.price.active] === 'Descending') {
        return BN(b.price)
          .minus(BN(a.price))
          .toNumber()
      }

      return 0
    })
}

const Orders = ({ below, within }) => {
  const [state, setState] = useState({
    order: { active: 0, payload: ['All', 'Buy', 'Sell'] },
    price: { active: 0, payload: ['Default', 'Ascending', 'Descending'] },
    token: { active: 0, payload: ['All', 'DAI', 'ANT', 'ETH'] },
    holder: { active: 0, payload: ['All', '0x277bfcf7c2e162cb1ac3e9ae228a3132a75f83d4'] },
    date: { payload: { start: new Date().getTime() - 1000000, end: new Date().getTime() + 7 * 10000000 } },
    showFilters: false,
  })

  return (
    <ContentWrapper>
      <h1 className="title">
        <Text>Historical Orders</Text>
      </h1>
      {within(0, 975) && <ToggleFiltersButton onClick={() => setState({ ...state, showFilters: !state.showFilters })} />}
      <div className={within(0, 975) ? (state.showFilters ? 'filter-nav' : ' filter-nav hide') : 'filter-nav'}>
        <div className="filter-item">
          <DateRangeInput
            startDate={new Date(state.date.payload.start)}
            endDate={new Date(state.date.payload.end)}
            onChange={payload => setState({ ...state, date: { payload: { start: payload.start.getTime(), end: payload.end.getTime() } } })}
          />
        </div>

        <div className="filter-item">
          <span className="filter-label">Holder</span>
          <DropDown
            items={state.holder.payload}
            active={state.holder.active}
            onChange={idx => setState({ ...state, holder: { ...state.holder, active: idx } })}
          />
        </div>
        <div className="filter-item">
          <span className="filter-label">Token</span>
          <DropDown items={state.token.payload} active={state.token.active} onChange={idx => setState({ ...state, token: { ...state.token, active: idx } })} />
        </div>
        <div className="filter-item">
          <span className="filter-label">Order Type</span>
          <DropDown items={state.order.payload} active={state.order.active} onChange={idx => setState({ ...state, order: { ...state.order, active: idx } })} />
        </div>
        <div className="filter-item">
          <span className="filter-label">Price</span>
          <DropDown items={state.price.payload} active={state.price.active} onChange={idx => setState({ ...state, price: { ...state.price, active: idx } })} />
        </div>
      </div>
      <Table
        header={
          !below('medium') && (
            <TableRow>
              <TableHeader title="Date" />
              <TableHeader title="Order Type" />
              <TableHeader title="Order State" />
              <TableHeader title="Address" />
              <TableHeader title="Amount" />
              <TableHeader title="Price" />
            </TableRow>
          )
        }
      >
        {!below('medium') &&
          filter(orders, state).map(order => {
            return (
              <TableRow key={order.id}>
                <TableCell>
                  <StyledText>{order.date.text}</StyledText>
                </TableCell>
                <TableCell>
                  <Badge
                    background={order.type === 'buy' ? theme.badgeAppBackground : theme.infoPermissionsBackground}
                    foreground={order.type === 'buy' ? theme.Purple : 'rgb(218, 192, 139)'}
                  >
                    {order.type === 'buy' ? 'Buy order' : 'Sell order'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    background={order.state === 'Pending' ? '#e5f1ff' : order.state === 'Cleared' ? theme.badgeAppBackground : theme.infoPermissionsBackground}
                    foreground={order.state === 'Pending' ? '#84acf5' : order.state === 'Cleared' ? theme.Purple : 'rgb(218, 192, 139)'}
                  >
                    {order.state}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StyledIdentityBadge entity={order.from} shorten={below('large')} />
                </TableCell>
                <TableCell>
                  <StyledText>
                    {order.type === 'buy' ? '+' : '-'}
                    {order.amount + '  '}
                    {order.collateral}
                  </StyledText>
                </TableCell>
                <TableCell>
                  <StyledText>{'$' + order.price}</StyledText>
                  <ContextMenu>
                    <SafeLink href={'https://etherscan.io/tx/' + order.txHash} target="_blank">
                      <ContextMenuItem>View Tx on Etherscan</ContextMenuItem>
                    </SafeLink>
                  </ContextMenu>
                </TableCell>
              </TableRow>
            )
          })}
        {below('medium') &&
          filter(orders, state).map(order => {
            return (
              <TableRow key={order.id}>
                <StyledCell>
                  <div
                    css={`
                      width: 100%;
                      margin-bottom: 1rem;
                    `}
                  >
                    <StyledText>{order.date.text}</StyledText>
                    <Badge
                      css={`
                        float: right;
                        margin-left: 1rem;
                      `}
                      background={
                        order.state === 'Pending' ? '#e5f1ff' : order.state === 'Cleared' ? theme.badgeAppBackground : theme.infoPermissionsBackground
                      }
                      foreground={order.state === 'Pending' ? '#84acf5' : order.state === 'Cleared' ? theme.Purple : 'rgb(218, 192, 139)'}
                    >
                      {order.state}
                    </Badge>
                    <Badge
                      css={`
                        float: right;
                      `}
                      background={order.type === 'buy' ? theme.badgeAppBackground : theme.infoPermissionsBackground}
                      foreground={order.type === 'buy' ? theme.Purple : 'rgb(218, 192, 139)'}
                    >
                      {order.type === 'buy' ? 'Buy order' : 'Sell order'}
                    </Badge>
                  </div>
                  <div
                    css={`
                      margin-bottom: 1rem;
                    `}
                  >
                    <StyledIdentityBadge entity={order.from} shorten={below('small')} />
                  </div>
                  <div
                    css={`
                      width: 100%;
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                    `}
                  >
                    <div>
                      <StyledText
                        css={`
                          margin-right: 2rem;
                        `}
                      >
                        {'Amount: '}
                        {order.type === 'buy' ? '+' : '-'}
                        {order.amount + '  '}
                        {order.collateral}
                      </StyledText>
                      <StyledText>{'Rate: $' + order.price}</StyledText>
                    </div>

                    <div>
                      <ContextMenu>
                        <SafeLink href={'https://etherscan.io/tx/' + order.txHash} target="_blank">
                          <ContextMenuItem>View Tx on Etherscan</ContextMenuItem>
                        </SafeLink>
                      </ContextMenu>
                    </div>
                  </div>
                </StyledCell>
              </TableRow>
            )
          })}
      </Table>
    </ContentWrapper>
  )
}

const ContentWrapper = styled.div`
  padding: 2rem;

  .title {
    font-weight: 600;
  }

  .filter-nav {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 2rem;
  }

  .hide {
    overflow: hidden;
    height: 0;
  }

  .filter-item {
    display: flex;
    align-items: center;
    margin-left: 2rem;
  }

  .filter-label {
    display: block;
    margin-right: 8px;
    font-variant: small-caps;
    text-transform: lowercase;
    color: ${theme.textSecondary};
    font-weight: 600;
    white-space: nowrap;
    ${unselectable};
  }

  @media only screen and (max-width: 1200px) {
    padding: 0;

    .title {
      margin: 1.5rem;
    }

    .filter-item:last-child {
      margin-right: 2rem;
    }
  }

  @media only screen and (max-width: 975px) {
    .filter-nav {
      flex-direction: column;
      margin-bottom: 1rem;
    }

    .filter-item {
      margin-bottom: 1rem;
    }
  }
`

const StyledCell = styled(TableCell)`
  & > div {
    flex-direction: column;
    align-items: start;
  }
`

const StyledText = styled(Text)`
  white-space: nowrap;
`

const StyledIdentityBadge = styled(IdentityBadge)`
  background-color: rgb(218, 234, 239);
`

export default props => <Viewport>{({ below, within }) => <Orders {...props} below={below} within={within} />}</Viewport>
