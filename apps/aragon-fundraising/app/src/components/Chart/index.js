import { Box, DropDown } from '@aragon/ui'
import React, { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import styled from 'styled-components'
import { startOfDay, endOfDay } from 'date-fns'
import DateRangeInput from '../DateRange/DateRangeInput'
import { filter } from './utils'

const bondingCurveData = [...Array(600).keys()].map(idx => ({
  tokens: idx + 1,
  price: (idx + 1) ** 2 / 50,
  label: 'Token: ' + (idx + 1),
}))

const items = ['Bonding curve', 'History chart']

export default ({ batches }) => {
  const [activeItem, setActiveItem] = useState(1)
  const [activeNavItem, setActiveNavItem] = useState(1)
  const [date, setDate] = useState({
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  })

  return (
    <Chart>
      <div className="navbar">
        {activeItem === 1 ? (
          <div className="timeline">
            <div>
              <div className={activeNavItem === 0 ? 'item active' : 'item'} onClick={() => setActiveNavItem(0)}>
                <span>1</span>
                <span>H</span>
              </div>
              <div className={activeNavItem === 1 ? 'item active' : 'item'} onClick={() => setActiveNavItem(1)}>
                <span>1</span>
                <span>D</span>
              </div>
              <div className={activeNavItem === 2 ? 'item active' : 'item'} onClick={() => setActiveNavItem(2)}>
                <span>1</span>
                <span>M</span>
              </div>
              <div className={activeNavItem === 3 ? 'item active' : 'item'} onClick={() => setActiveNavItem(3)}>
                <span>1</span>
                <span>Y</span>
              </div>
              <span className={activeNavItem === 4 ? 'item active' : 'item'} onClick={() => setActiveNavItem(4)}>
                ALL
              </span>
            </div>
            <DateRangeInput
              startDate={date.start}
              endDate={date.end}
              onClick={() => setActiveNavItem(5)}
              onChange={date => setDate(date)}
              active={activeNavItem === 5}
            />
          </div>
        ) : (
          <div />
        )}
        {/* <div className="chart-view">
          <p className="chart-view-text">Chart view</p>
          <DropDown items={items} selected={activeItem} onChange={index => setActiveItem(index)} />
        </div> */}
      </div>
      {activeItem === 0 && (
        <ResponsiveContainer height={400}>
          <AreaChart margin={{ left: 40, bottom: 40, top: 40, right: 40 }} height={400} data={bondingCurveData}>
            <defs>
              <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#08BEE5" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#08BEE5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />

            <XAxis type="number" dataKey="tokens" hide={false} interval="preserveStartEnd" tickMargin={25} tickLine={false} axisLine={false} tickCount={5} />
            <YAxis tickMargin={25} tickLine={false} axisLine={false} />
            <ReferenceDot isFront x={210} y={882} r={6} fill="#08BEE5" stroke="none" />
            <Tooltip labelFormatter={value => 'Bonded tokens: ' + value} />
            <Area isAnimationActive strokeWidth={2} type="monotone" dataKey="price" stroke="#08BEE5" fillOpacity={1} fill="url(#colorBlue)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {activeItem === 1 && (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart margin={{ left: 40, bottom: 40, top: 40, right: 40 }} data={filter(batches, activeNavItem, date)} barSize={20}>
            <Tooltip cursor={{ fill: '#08BEE5', fillOpacity: '0.2' }} />
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis dataKey="date" minTickGap={100} interval="preserveStartEnd" tickMargin={25} tickLine={false} axisLine={false} />
            <YAxis tickMargin={25} tickLine={false} axisLine={false} />
            <Bar isAnimationActive dataKey="price" fill="#08BEE5" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Chart>
  )
}

const Chart = styled(Box)`
  box-sizing: border-box;

  .navbar {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
    margin-right: 3rem;
    margin-left: 4rem;

    .timeline {
      display: flex;
      justify-content: space-between;
      width: 100%;

      & > div:nth-child(1) {
        display: flex;
        align-items: center;
        font-weight: bold;
        font-size: 16px;
      }

      .item {
        margin-right: 1.5rem;
        color: rgba(109, 119, 123, 0.7);
      }
      .item:last-child {
        margin-right: 2rem;
      }
      .item:hover {
        cursor: pointer;
        border-bottom: 2px solid #08bee5;
      }
      .item.active {
        border-bottom: 2px solid #08bee5;
      }

      .item > span:nth-child(1) {
        margin-right: 0.25rem;
        color: black;
      }
    }

    .chart-view {
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }

    .chart-view-text {
      font-size: 16px;
      color: #637381;
      margin-right: 1rem;
      white-space: nowrap;
    }
  }

  @media only screen and (max-width: 1152px) {
    .navbar {
      flex-direction: column-reverse;
      align-items: flex-end;

      .timeline {
        margin-top: 2rem;
      }

      .chart-view {
        justify-content: flex-start;
      }
    }
  }

  @media only screen and (max-width: 700px) {
    .timeline {
      flex-direction: column-reverse;

      & > div:nth-child(1) {
        margin-top: 2rem;
        justify-content: flex-end;
      }
      .item:last-child {
        margin-right: 0;
      }
    }
  }
`
