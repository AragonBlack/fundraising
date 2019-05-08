import { DropDown } from '@aragon/ui'
import { format } from 'date-fns'
import React, { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import styled from 'styled-components'
import DateRangeInput from '../DateRange/DateRangeInput'

const bondingCurveData = [...Array(24).keys()].map(idx => ({
  tokens: idx + 1,
  Price: idx ** 3 + 1000,
  label: 'Token: ' + (idx + 1),
}))

// const timelineData = [...Array(24).keys()].map(x => ({
//   tokens: x,
//   Price: 0.05 * x ** 2 + 10 * x * Math.random(),
//   label: 'Token: ' + (x + 1),
// }))

const historyChartData = [...Array(100).keys()]
  .map(idx => ({
    Price: Math.random() * 140 + 60,
    date: format(new Date(new Date().getTime() - (idx * 8000000 + 10000000)), 'd MMM', { awareOfUnicodeTokens: true }),
  }))
  .reverse()

const items = ['Bonding curve', 'History chart']

export default () => {
  const [activeItem, setActiveItem] = useState(0)
  const [activeNavItem, setActiveNavItem] = useState(4)

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
            <DateRangeInput startDate={new Date(new Date().getTime() - 1000000000)} endDate={new Date()} onChange={test => console.log(test)} />
          </div>
        ) : (
          <div />
        )}
        <div className="chart-view">
          <p className="chart-view-text">Chart view</p>
          <DropDown items={items} active={activeItem} onChange={index => setActiveItem(index)} />
        </div>
      </div>
      {activeItem === 0 && (
        <ResponsiveContainer height={400}>
          <AreaChart margin={{ left: 40, bottom: 40, top: 40, right: 40 }} height={400} data={bondingCurveData}>
            <defs>
              <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#109CF1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#109CF1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis type="number" dataKey="tokens" hide={false} interval="preserveStartEnd" tickMargin={25} tickLine={false} axisLine={false} tickCount={5} />
            <YAxis tickMargin={25} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={value => 'Bonded tokens: ' + value} />
            <Area isAnimationActive={true} strokeWidth={2} type="monotone" dataKey="Price" stroke="#109CF1" fillOpacity={1} fill="url(#colorBlue)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {activeItem === 1 && (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart margin={{ left: 40, bottom: 40, top: 40, right: 40 }} data={historyChartData}>
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis dataKey="date" minTickGap={100} interval="preserveStartEnd" tickMargin={25} tickLine={false} axisLine={false} />
            <YAxis tickMargin={25} tickLine={false} axisLine={false} />
            <Bar isAnimationActive={true} dataKey="Price" fill="#109CF1" />
            <Tooltip />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Chart>
  )
}

const Chart = styled.div`
  background: #fff;
  border: 1px solid rgba(209, 209, 209, 0.5);
  box-sizing: border-box;
  border-radius: 3px;

  .navbar {
    display: flex;
    justify-content: space-between;
    margin-top: 2rem;
    margin-right: 3rem;
    margin-left: 12rem;

    .timeline {
      display: flex;

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
      .item:hover {
        cursor: pointer;
        border-bottom: 2px solid #1dd9d5;
      }
      .item.active {
        border-bottom: 2px solid #1dd9d5;
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
      font-weight: bold;
      font-size: 12px;
      color: #6d777b;
      opacity: 0.7;
      text-transform: uppercase;
      margin-right: 1rem;
      flex-wrap: nowrap;
    }
  }

  @media only screen and (max-width: 1050px) {
    .navbar {
      margin-left: 6rem;
    }
  }

  @media only screen and (max-width: 920px) {
    .navbar {
      margin-left: 6rem;
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
