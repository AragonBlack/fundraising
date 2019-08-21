import React, { useState } from 'react'
import {
  DataView,
  DropDown,
  SafeLink,
  Text,
  theme,
  unselectable,
  IdentityBadge,
  useLayout,
  ContextMenu,
  ContextMenuItem,
  IconCheck,
  IconClock,
  IconEllipsis,
  shortenAddress,
} from '@aragon/ui'
import { format, subYears } from 'date-fns'
import styled from 'styled-components'
import DateRangeInput from '../components/DateRange/DateRangeInput'
import ToggleFiltersButton from '../components/ToggleFiltersButton'
import { Order } from '../constants'
import { round } from '../lib/math-utils'
import EmptyOrders from '../assets/EmptyOrders.svg'

const multiplyArray = (base, times) => {
  return [...Array(times)].reduce(v => [...v, ...base], [])
}

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
          if (filter.payload[filter.active].toLowerCase() !== order.symbol.toLowerCase()) {
            return false
          }
        }

        if (type === 'holder' && filter.payload[filter.active] !== 'All') {
          if (filter.payload[filter.active].toLowerCase() !== order.address.toLowerCase()) {
            return false
          }
        }

        if (type === 'date') {
          if (filter.payload.start > order.timestamp || filter.payload.end < order.timestamp) {
            return false
          }
        }
      }
      return true
    })
    .sort((a, b) => {
      if (state.price.payload[state.price.active] === 'Ascending') {
        return a.price.minus(b.price).toNumber()
      } else if (state.price.payload[state.price.active] === 'Descending') {
        return b.price.minus(a.price).toNumber()
      }

      return 0
    })
}

const getIconState = state => {
  if (state === Order.State.RETURNED) {
    return <IconCheck size="small" color="#2CC68F" />
  } else if (state === Order.State.OVER) {
    return <IconClock size="small" color="#08BEE5" />
  } else if (state === Order.State.PENDING) {
    return <IconEllipsis size="small" color="#6D777B" />
  }
}

const getHolders = orders => ['All'].concat(Array.from(new Set(orders.map(o => o.address))))
const getCollaterals = orders => ['All'].concat(Array.from(new Set(orders.map(o => o.symbol))))

export default ({ orders }) => {
  const [state, setState] = useState({
    order: { active: 0, payload: ['All', 'Buy', 'Sell'] },
    price: { active: 0, payload: ['Default', 'Ascending', 'Descending'] },
    token: { active: 0, payload: getCollaterals(orders) },
    holder: { active: 0, payload: getHolders(orders) },
    date: { payload: { start: subYears(new Date(), 1).getTime(), end: new Date().getTime() } },
    showFilters: false,
  })
  const [page, setPage] = useState(0)
  const { name: layoutName } = useLayout()
  return (
    <ContentWrapper>
      {!orders.length && (
        <EmptyState>
          <img src={EmptyOrders} />
          <p css="font-size: 24px; margin-top: 1rem;">There are no orders to show.</p>
        </EmptyState>
      )}
      {!!orders.length && (
        <DataView
          page={page}
          onPageChange={setPage}
          fields={['Date', 'Address', 'Status', 'Order Amount', 'Token Price', 'Order Type', 'Tokens']}
          entries={filter(multiplyArray(orders, 10), state)}
          mode={layoutName !== 'large' ? 'list' : 'table'}
          heading={
            <div>
              {layoutName !== 'large' && (
                <ToggleFiltersButton onClick={() => setState({ ...state, showFilters: !state.showFilters })} active={state.showFilters} />
              )}
              <div className={layoutName !== 'large' ? (state.showFilters ? 'filter-nav' : ' filter-nav hide') : 'filter-nav'}>
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
                    renderLabel={() => shortenAddress(state.holder.payload[state.holder.active])}
                    onChange={idx => setState({ ...state, holder: { ...state.holder, active: idx } })}
                  />
                </div>
                <div className="filter-item">
                  <span className="filter-label">Token</span>
                  <DropDown
                    items={state.token.payload}
                    selected={state.token.active}
                    onChange={idx => setState({ ...state, token: { ...state.token, active: idx } })}
                  />
                </div>
                <div className="filter-item">
                  <span className="filter-label">Order Type</span>
                  <DropDown
                    items={state.order.payload}
                    selected={state.order.active}
                    onChange={idx => setState({ ...state, order: { ...state.order, active: idx } })}
                  />
                </div>
                <div className="filter-item">
                  <span className="filter-label">Price</span>
                  <DropDown
                    items={state.price.payload}
                    selected={state.price.active}
                    onChange={idx => setState({ ...state, price: { ...state.price, active: idx } })}
                  />
                </div>
              </div>
            </div>
          }
          renderEntry={data => {
            return [
              <StyledText>{format(data.timestamp, 'MM/dd/yyyy - HH:mm:ss', { awareOfUnicodeTokens: true })}</StyledText>,
              <IdentityBadge entity={data.address} />,
              <div css="display: flex; align-items: center;">
                {getIconState(data.state)}
                <p css="margin-top: 0.25rem; margin-left: 0.25rem;">{data.state.charAt(0) + data.state.slice(1).toLowerCase()}</p>
              </div>,
              <p css={data.type === Order.Type.BUY ? 'font-weight: 600; color: #2CC68F;' : 'font-weight: 600;'}>
                {data.type === Order.Type.BUY ? '+' : '-'}
                {round(data.amount, 3) + ' '}
                {data.symbol}
              </p>,
              <p css="font-weight: 600;">${round(data.price, 3)}</p>,
              data.type === Order.Type.BUY ? (
                <div
                  css={`
                    display: inline-block;
                    border-radius: 100px;
                    background-color: rgba(204, 189, 244, 0.3);
                    padding: 2px 2rem;
                    text-transform: uppercase;
                    color: #7546f2;
                    font-size: 12px;
                    font-weight: 700;
                  `}
                >
                  {data.type}
                </div>
              ) : (
                <div
                  css={`
                    display: inline-block;
                    border-radius: 100px;
                    background-color: rgb(255, 212, 140, 0.3);
                    padding: 2px 2rem;
                    text-transform: uppercase;
                    color: #f08658;
                    font-size: 12px;
                    font-weight: 700;
                  `}
                >
                  {data.type}
                </div>
              ),
              <p css="font-weight: 600;">{round(data.tokens, 3)}</p>,
            ]
          }}
          renderEntryActions={data => (
            <ContextMenu>
              <SafeLink href={'https://etherscan.io/tx/' + data.transactionHash} target="_blank">
                <ContextMenuItem>View Tx on Etherscan</ContextMenuItem>
              </SafeLink>
            </ContextMenu>
          )}
        />
      )}
    </ContentWrapper>
  )
}

const ContentWrapper = styled.div`
  margin-top: 1rem;
  margin-bottom: 2rem;

  .hide {
    overflow: hidden;
    height: 0;
  }

  .filter-nav {
    display: flex;
    justify-content: flex-end;
    margin-right: 1.5rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
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

  @media only screen and (max-width: 1152px) {
    .filter-nav {
      flex-direction: column;
      margin-bottom: 1rem;
    }

    .filter-item {
      margin-left: 0;
      margin-bottom: 1rem;
    }

    .filter-item:last-child {
      margin-right: 2rem;
    }
  }
`

const StyledText = styled(Text)`
  white-space: nowrap;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 500px;

  border-radius: 4px;
  border-style: solid;
  border-color: #dde4e9;
  border-width: 1px;
  background: #ffffff;
`
