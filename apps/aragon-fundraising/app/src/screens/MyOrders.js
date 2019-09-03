import React, { useContext, useEffect, useState } from 'react'
import { DataView, _DateRange as DateRange, DropDown, SafeLink, Text, theme, unselectable, useLayout, ContextMenu, ContextMenuItem, Button } from '@aragon/ui'
import { useApi, useAppState, useConnectedAccount } from '@aragon/api-react'
import { format, subYears, endOfToday } from 'date-fns'
import styled from 'styled-components'
import ToggleFiltersButton from '../components/ToggleFiltersButton'
import OrderTypeTag from '../components/OrderTypeTag'
import OrderState from '../components/OrderState'
import { Order } from '../constants'
import { formatBigNumber } from '../utils/bn-utils'
import EmptyOrders from '../assets/EmptyOrders.svg'
import { MainViewContext } from '../context'

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

        if (type === 'date') {
          if (filter.payload.start > order.timestamp || filter.payload.end < order.timestamp) {
            return false
          }
        }
      }
      return true
    })
    .reverse()
    .sort((a, b) => {
      if (state.price.payload[state.price.active] === 'Ascending') {
        return a.price - b.price
      } else if (state.price.payload[state.price.active] === 'Descending') {
        return b.price - a.price
      }

      return 0
    })
}

const getCollaterals = orders => ['All'].concat(Array.from(new Set(orders.map(o => o.symbol))))

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    orders,
    collaterals: {
      dai: { decimals: daiDecimals },
      ant: { decimals: antDecimals },
    },
    bondedToken: { decimals: tokenDecimals },
  } = useAppState()

  // *****************************
  // context state
  // *****************************
  const { batchId } = useContext(MainViewContext)

  // *****************************
  // aragon api
  // *****************************
  const account = useConnectedAccount()
  const api = useApi()

  // *****************************
  // internal state
  // *****************************
  const [filteredOrders, setFilteredOrders] = useState(orders)
  const [state, setState] = useState({
    order: { active: 0, payload: ['All', 'Buy', 'Sell'] },
    price: { active: 0, payload: ['Default', 'Ascending', 'Descending'] },
    token: { active: 0, payload: getCollaterals(filteredOrders) },
    date: { payload: { start: subYears(new Date(), 1).getTime(), end: endOfToday() } },
    showFilters: false,
  })
  const [page, setPage] = useState(0)
  const { name: layoutName } = useLayout()

  // *****************************
  // effects
  // *****************************
  // filter the orders when the account changes
  // or when the polled batchId changes
  useEffect(() => {
    const updatedOrders = orders
      .filter(({ user }) => user === account)
      .map(o => {
        if (o.batchId < batchId && o.state === Order.state.PENDING) return { ...o, state: Order.state.OVER }
        else return o
      })
    setFilteredOrders(updatedOrders)
  }, [account, batchId])

  // *****************************
  // handlers
  // *****************************
  const handleClaim = ({ batchId, collateral, type }) => {
    const functionToCall = type === Order.type.BUY ? 'claimBuyOrder' : 'claimSellOrder'
    api[functionToCall](batchId, collateral)
      .toPromise()
      .catch(console.error)
  }

  return (
    <ContentWrapper>
      {!filteredOrders.length && (
        <EmptyState>
          <img src={EmptyOrders} />
          <p css="font-size: 24px; margin-top: 1rem;">There are no orders to show.</p>
        </EmptyState>
      )}
      {!!filteredOrders.length && (
        <DataView
          page={page}
          onPageChange={setPage}
          fields={['Date', 'Status', 'Order Amount', 'Token Price', 'Order Type', 'Tokens', 'Actions']}
          entries={filter(filteredOrders, state)}
          mode={layoutName !== 'large' ? 'list' : 'table'}
          heading={
            <div>
              {layoutName !== 'large' && (
                <ToggleFiltersButton onClick={() => setState({ ...state, showFilters: !state.showFilters })} active={state.showFilters} />
              )}
              <div className={layoutName !== 'large' ? (state.showFilters ? 'filter-nav' : ' filter-nav hide') : 'filter-nav'}>
                <div className="filter-item">
                  <DateRange
                    startDate={new Date(state.date.payload.start)}
                    endDate={new Date(state.date.payload.end)}
                    onChange={payload => setState({ ...state, date: { payload: { start: payload.start.getTime(), end: payload.end.getTime() } } })}
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
              <StyledText key="date">{format(data.timestamp, 'MM/dd/yyyy - HH:mm:ss', { awareOfUnicodeTokens: true })}</StyledText>,
              <div key="status" css="display: flex; align-items: center;">
                <OrderState state={data.state} />
              </div>,
              <p key="orderAmount" css={data.type === Order.type.BUY ? 'font-weight: 600; color: #2CC68F;' : 'font-weight: 600;'}>
                {formatBigNumber(data.value, data.symbol === 'DAI' ? daiDecimals : antDecimals)} {data.symbol}
              </p>,
              <p key="tokenPrice" css="font-weight: 600;">
                ${formatBigNumber(data.price, 0)}
              </p>,
              <OrderTypeTag key="type" type={data.type} />,
              <p key="tokens" css="font-weight: 600;">
                {formatBigNumber(data.amount, tokenDecimals)}
              </p>,
              data.state === Order.state.OVER ? (
                <Button mode="strong" label="Claim" onClick={() => handleClaim(data)}>
                  Claim
                </Button>
              ) : null,
            ]
          }}
          renderEntryActions={data => (
            <ContextMenu>
              <SafeLink href={'https://etherscan.io/tx/' + data.txHash} target="_blank">
                <ContextMenuItem>View tx on Etherscan</ContextMenuItem>
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
