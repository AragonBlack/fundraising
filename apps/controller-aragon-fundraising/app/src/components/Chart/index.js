import { DropDown } from '@aragon/ui'
import { differenceInDays, format, startOfMinute, startOfMonth, startOfWeek, subDays, subHours, subSeconds } from 'date-fns'
import React, { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import styled from 'styled-components'
import DateRangeInput from '../DateRange/DateRangeInput'

const bondingCurveData = [...Array(600).keys()].map(idx => ({
  tokens: idx + 1,
  Price: (idx + 1) ** 2 / 50,
  label: 'Token: ' + (idx + 1),
}))

// const everyThirtySecondsData = [...Array(2 * 60 * 24 * 10).keys()]
//   .map(idx => ({
//     Price: Math.random() * 140 + 60,
//     timestamp: subSeconds(new Date(), 30 * idx).getTime(),
//   }))
//   .reverse()

const everyThirtySecondsData = [...Array(2 * 60 * 24 * 10).keys()]
  .map(idx => ({
    Price: Math.random() * 140 + 60,
    timestamp: subSeconds(new Date(), 30 * idx).getTime(),
  }))
  .reverse()

const everyHourData = [...Array(24 * 365 * 2).keys()]
  .map(idx => ({
    Price: Math.random() * 140 + 60,
    timestamp: subHours(new Date(), idx).getTime(),
  }))
  .reverse()

const everyDayData = [...Array(365 * 3).keys()]
  .map(idx => ({
    Price: Math.random() * 140 + 60,
    timestamp: subDays(new Date(), idx).getTime(),
  }))
  .reverse()

function roundTimeHalfAnHour(time) {
  var timeToReturn = new Date(time)

  timeToReturn.setMilliseconds(Math.round(time.getMilliseconds() / 1000) * 1000)
  timeToReturn.setSeconds(Math.round(timeToReturn.getSeconds() / 60) * 60)
  timeToReturn.setMinutes(Math.round(timeToReturn.getMinutes() / 30) * 30)
  return timeToReturn
}

function roundTime6Hours(time) {
  var timeToReturn = new Date(time)

  timeToReturn.setMilliseconds(Math.round(time.getMilliseconds() / 1000) * 1000)
  timeToReturn.setSeconds(Math.round(timeToReturn.getSeconds() / 60) * 60)
  timeToReturn.setMinutes(Math.round(timeToReturn.getMinutes() / 60) * 60)
  timeToReturn.setHours(Math.round(timeToReturn.getHours() / 6) * 6)
  return timeToReturn
}

function roundTime12Hours(time) {
  var timeToReturn = new Date(time)

  timeToReturn.setMilliseconds(Math.round(time.getMilliseconds() / 1000) * 1000)
  timeToReturn.setSeconds(Math.round(timeToReturn.getSeconds() / 60) * 60)
  timeToReturn.setMinutes(Math.round(timeToReturn.getMinutes() / 60) * 60)
  timeToReturn.setHours(Math.round(timeToReturn.getHours() / 12) * 12)
  return timeToReturn
}

const getFilteredData = (data, timestampFilter) => {
  let cache = {}
  data.forEach(item => {
    const timestamp = timestampFilter(item.timestamp).getTime()
    let current = cache[timestamp]

    if (current) {
      cache[timestamp] = {
        avg: (item.Price + current.avg * current.iteration) / (current.iteration + 1),
        iteration: current.iteration + 1,
      }
    } else {
      cache[timestamp] = {
        avg: item.Price,
        iteration: 1,
      }
    }
  })

  return cache
}

const filter = (period, interval) => {
  if (period === 0) {
    const cache = getFilteredData(everyThirtySecondsData, startOfMinute)

    return Object.keys(cache)
      .slice(-60)
      .map(key => ({
        Price: cache[key].avg,
        date: format(Number(key), 'HH:mm'),
      }))
  }

  if (period === 1) {
    const cache = getFilteredData(everyThirtySecondsData, timestamp => roundTimeHalfAnHour(new Date(timestamp)))

    return Object.keys(cache)
      .slice(-48)
      .map(key => ({
        Price: cache[key].avg,
        date: format(Number(key), 'MMM dd HH:mm'),
      }))
  }

  if (period === 2) {
    const cache = getFilteredData(everyHourData, timestamp => roundTime12Hours(new Date(timestamp)))

    return Object.keys(cache)
      .slice(-60)
      .map(key => ({
        Price: cache[key].avg,
        date: format(Number(key), 'MMM dd HH:mm'),
      }))
  }

  if (period === 3) {
    const cache = getFilteredData(everyHourData, startOfWeek)

    return Object.keys(cache)
      .slice(-56)
      .map(key => ({
        Price: cache[key].avg,
        date: format(Number(key), 'y MMM dd'),
      }))
  }

  if (period === 4) {
    const cache = getFilteredData(everyDayData, startOfMonth)

    return Object.keys(cache).map(key => ({
      Price: cache[key].avg,
      date: format(Number(key), 'y MMM dd'),
    }))
  }

  if (period === 5) {
    const difference = differenceInDays(interval.end, interval.start)
    if (difference < 2) {
      const cache = getFilteredData(everyThirtySecondsData, timestamp => roundTimeHalfAnHour(new Date(timestamp)))

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          Price: cache[key].avg,
          date: format(Number(key), 'MMM dd HH:mm'),
        }))
    } else if (difference < 31) {
      const cache = getFilteredData(everyHourData, timestamp => roundTime6Hours(new Date(timestamp)))

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          Price: cache[key].avg,
          date: format(Number(key), 'MMM dd HH:mm'),
        }))
    } else if (difference < 365) {
      const cache = getFilteredData(everyHourData, startOfWeek)

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          Price: cache[key].avg,
          date: format(Number(key), 'y MMM dd'),
        }))
    } else {
      const cache = getFilteredData(everyDayData, startOfMonth)

      return Object.keys(cache)
        .filter(key => Number(key) > interval.start && Number(key) < interval.end)
        .map(key => ({
          Price: cache[key].avg,
          date: format(Number(key), 'y MMM dd'),
        }))
    }
  }
}

// const orders = [
//   {
//     type: BUY | SELL,
//     holder: 0xaf85...,
//     collateral: 0xefa....,
//     price: 6.7,
//     amount: 65,
//     timestamp: 12312315153,
//   },
//   {
//      ...
//   },
//   ...
// ]

const items = ['Bonding curve', 'History chart']

export default () => {
  const [activeItem, setActiveItem] = useState(0)
  const [activeNavItem, setActiveNavItem] = useState(0)
  const [date, setDate] = useState({
    start: new Date(new Date().getTime() - 1000000000),
    end: new Date(),
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
            <ReferenceDot isFront x={210} y={882} r={6} fill="#109CF1" stroke="none" />
            <Tooltip labelFormatter={value => 'Bonded tokens: ' + value} />
            <Area isAnimationActive={true} strokeWidth={2} type="monotone" dataKey="Price" stroke="#109CF1" fillOpacity={1} fill="url(#colorBlue)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {activeItem === 1 && (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart margin={{ left: 40, bottom: 40, top: 40, right: 40 }} data={filter(activeNavItem, date)}>
            <Tooltip cursor={{ fill: '#109CF1', fillOpacity: '0.2' }} />
            <CartesianGrid strokeDasharray="8 8" vertical={false} />
            <XAxis dataKey="date" minTickGap={100} interval="preserveStartEnd" tickMargin={25} tickLine={false} axisLine={false} />
            <YAxis tickMargin={25} tickLine={false} axisLine={false} />
            <Bar isAnimationActive={true} dataKey="Price" fill="#109CF1" />
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
