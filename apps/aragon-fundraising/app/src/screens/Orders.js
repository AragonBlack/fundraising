import React, { useContext, useEffect, useState } from 'react'
import {
  Button,
  ContextMenu,
  ContextMenuItem,
  DataView,
  _DateRange as DateRange,
  DropDown,
  IdentityBadge,
  SafeLink,
  shortenAddress,
  Text,
  theme,
  unselectable,
  useLayout,
} from '@aragon/ui'
import { useApi, useAppState, useConnectedAccount } from '@aragon/api-react'
import { format, subYears, endOfToday } from 'date-fns'
import styled from 'styled-components'
import ToggleFiltersButton from '../components/ToggleFiltersButton'
import OrderTypeTag from '../components/Orders/OrderTypeTag'
import OrderState from '../components/Orders/OrderState'
import NoData from '../components/NoData'
import { Order } from '../constants'
import { formatBigNumber } from '../utils/bn-utils'
import { MainViewContext } from '../context'

/**
 * Keeps an order if within the date range
 * @param {Object} order - a background script order object
 * @param {Object} dateFilter - a filter with a start and end timestamp
 * @returns {Boolean} true if within, false otherwise
 */
const withinDateRange = (order, { payload: { start, end } }) => {
  return order.timestamp > start && order.timestamp < end
}

/**
 * Keeps an order if matching the payload
 * @param {Object} order - a background script order object
 * @param {Object} filter - a filter with a type, payload and active payload
 * @returns {Boolean} true if matching, false otherwise
 */
const withMatchingFilter = (order, { active, payload, type }) => {
  // the filter is "off", all orders should pass this filter
  if (payload[active] === 'All') return true
  // the filter should only keep the matching orders
  else return payload[active].toLowerCase() === order[type].toLowerCase()
}

export default ({ myOrders }) => {
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
  // updatedOrders are the bg-script orders with the computed state from polled batchId
  const [updatedOrders, setUpdatedOrders] = useState(orders)
  // filteredOrders are a filtered view of the updatedOrders (according the filters)
  const [filteredOrders, setFilteredOrders] = useState(updatedOrders)
  const symbols = ['All'].concat(Array.from(new Set(filteredOrders.map(o => o.symbol))))
  const users = ['All'].concat(Array.from(new Set(filteredOrders.map(o => o.user))))
  const [typeFilter, setTypeFilter] = useState({ active: 0, payload: ['All', 'Buy', 'Sell'], type: 'type' })
  const [priceFilter, setPriceFilter] = useState({ active: 0, payload: ['Default', 'Ascending', 'Descending'], type: 'price' })
  const [symbolFilter, setSymbolFilter] = useState({ active: 0, payload: symbols, type: 'symbol' })
  const [userFilter, setUserFilter] = useState({ active: 0, payload: users, type: 'user' })
  const [dateFilter, setDateFilter] = useState({ payload: { start: subYears(new Date(), 1).getTime(), end: endOfToday().getTime() }, type: 'date' })
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)
  const { name: layoutName } = useLayout()
  const dataViewFields = myOrders
    ? ['Date', 'Status', 'Order Amount', 'Token Price', 'Order Type', 'Tokens', 'Actions']
    : ['Date', 'Holder', 'Status', 'Order Amount', 'Token Price', 'Order Type', 'Tokens']

  // *****************************
  // effects
  // *****************************
  // UPDATE the orders when:
  // - the polled batchId changes
  useEffect(() => {
    const updatedOrders = orders
      // keep only the connected user orders if myOrder === true
      .filter(({ user }) => {
        if (myOrders) return user === account
        else return true
      })
      // update the state if the batchId changed
      .map(o => {
        if (o.batchId < batchId && o.state === Order.state.PENDING) return { ...o, state: Order.state.OVER }
        else return o
      })
    setUpdatedOrders(updatedOrders)
  }, [batchId, account, orders])

  // FILTER the orders when:
  // - when updatedOrders is changed
  // - the account changes
  // - a filter is changed
  useEffect(() => {
    const filteredOrders = updatedOrders
      // keep the orders satisfaying the date filter
      .filter(o => withinDateRange(o, dateFilter))
      // keep the orders satisfaying the user filter (always to 'ALL' when myOrder is true)
      .filter(o => withMatchingFilter(o, userFilter))
      // keep the orders satisfaying the symbol filter
      .filter(o => withMatchingFilter(o, symbolFilter))
      // keep the orders satisfaying the type filter
      .filter(o => withMatchingFilter(o, typeFilter))
      // reverse the result
      .reverse()
      // sort by price
      .sort((a, b) => {
        const pricePayload = priceFilter.payload[priceFilter.active]
        if (pricePayload === 'Ascending') return a.price.minus(b.price).toNumber()
        else if (pricePayload === 'Descending') return b.price.minus(a.price).toNumber()
        else return 0
      })
    setFilteredOrders(filteredOrders)
  }, [updatedOrders, typeFilter, priceFilter, symbolFilter, userFilter, dateFilter])

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
      {updatedOrders.length === 0 && <NoData message="There are no orders to show." />}
      {updatedOrders.length > 0 && (
        <DataView
          page={page}
          onPageChange={setPage}
          fields={dataViewFields}
          entries={filteredOrders}
          mode={layoutName !== 'large' ? 'list' : 'table'}
          heading={
            <div>
              {layoutName !== 'large' && <ToggleFiltersButton onClick={() => setShowFilters(!showFilters)} active={showFilters} />}
              <div className={layoutName !== 'large' ? (showFilters ? 'filter-nav' : ' filter-nav hide') : 'filter-nav'}>
                <div className="filter-item">
                  <DateRange
                    startDate={new Date(dateFilter.payload.start)}
                    endDate={new Date(dateFilter.payload.end)}
                    onChange={data => setDateFilter({ ...dateFilter, payload: { start: data.start.getTime(), end: data.end.getTime() } })}
                  />
                </div>
                {!myOrders && (
                  <div className="filter-item">
                    <span className="filter-label">Holder</span>
                    <DropDown
                      items={userFilter.payload}
                      selected={userFilter.active}
                      renderLabel={() => shortenAddress(userFilter.payload[userFilter.active])}
                      onChange={idx => setUserFilter({ ...userFilter, active: idx })}
                    />
                  </div>
                )}
                <div className="filter-item">
                  <span className="filter-label">Token</span>
                  <DropDown items={symbolFilter.payload} selected={symbolFilter.active} onChange={idx => setSymbolFilter({ ...symbolFilter, active: idx })} />
                </div>
                <div className="filter-item">
                  <span className="filter-label">Order Type</span>
                  <DropDown items={typeFilter.payload} selected={typeFilter.active} onChange={idx => setTypeFilter({ ...typeFilter, active: idx })} />
                </div>
                <div className="filter-item">
                  <span className="filter-label">Price</span>
                  <DropDown items={priceFilter.payload} selected={priceFilter.active} onChange={idx => setPriceFilter({ ...priceFilter, active: idx })} />
                </div>
              </div>
            </div>
          }
          renderEntry={data => {
            const entry = []
            const sign = data.type === Order.type.BUY ? '+' : '-'
            // timestamp
            entry.push(<StyledText key="date">{format(data.timestamp, 'MM/dd/yyyy - HH:mm:ss', { awareOfUnicodeTokens: true })}</StyledText>)
            // user if not myOrders
            if (!myOrders) entry.push(<IdentityBadge key="address" entity={data.user} />)
            // status
            entry.push(
              <div key="status" css="display: flex; align-items: center;">
                <OrderState state={data.state} />
              </div>
            )
            // value
            entry.push(
              <p key="orderAmount" css={data.type === Order.type.BUY ? 'font-weight: 600; color: #2CC68F;' : 'font-weight: 600;'}>
                {formatBigNumber(data.value, data.symbol === 'DAI' ? daiDecimals : antDecimals, { numberPrefix: sign })} {data.symbol}
              </p>
            )
            // price
            entry.push(
              <p key="tokenPrice" css="font-weight: 600;">
                {formatBigNumber(data.price, 0, { numberPrefix: '$' })}
              </p>
            )
            // type
            entry.push(<OrderTypeTag key="type" type={data.type} />)
            // amount
            entry.push(
              <p key="tokens" css="font-weight: 600;">
                {formatBigNumber(data.amount, tokenDecimals, { numberPrefix: sign })}
              </p>
            )
            // claim button if myOrders
            if (myOrders)
              entry.push(
                data.state === Order.state.OVER ? (
                  <Button mode="strong" label="Claim" onClick={() => handleClaim(data)}>
                    Claim
                  </Button>
                ) : null
              )
            return entry
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
