import React, { useState, useEffect } from 'react'
import { useAppState } from '@aragon/api-react'
import { useLayout } from '@aragon/ui'
import isAfter from 'date-fns/isAfter'
import subHours from 'date-fns/subHours'
import subDays from 'date-fns/subDays'
import subWeeks from 'date-fns/subWeeks'
import subMonths from 'date-fns/subMonths'
import subYears from 'date-fns/subYears'
import { VictoryChart, VictoryZoomContainer, VictoryLine, VictoryBrushContainer, VictoryAxis } from 'victory'
import Filter from './Filter'
import theme, { brushStyle } from './theme'
import CustomBrush from './CustomBrush'
import ChartMenu from './ChartMenu'

export default ({ activeChart, setActiveChart }) => {
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const lastOrder = Math.max(...timestamps)
  const [zoomDomain, setZoomDomain] = useState({ x: [firstOrder, lastOrder] })
  const [brushDomain, setBrushDomain] = useState({ x: [firstOrder, lastOrder] })
  const [activeItem, setActiveItem] = useState(5)
  const { layoutWidth } = useLayout()

  useEffect(() => {
    const functionToCall = [subHours, subDays, subWeeks, subMonths, subYears, x => firstOrder][activeItem]
    const start = functionToCall(lastOrder, 1)
    setZoomDomain({ x: [start, lastOrder] })
    setBrushDomain({ x: [isAfter(start, firstOrder) ? start : firstOrder, lastOrder] })
  }, [activeItem])

  return (
    <>
      <div className="navbar">
        <div className="timeline">
          <Filter label={{ first: '1', second: 'H' }} index={0} active={activeItem === 0} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'D' }} index={1} active={activeItem === 1} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'W' }} index={2} active={activeItem === 2} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'M' }} index={3} active={activeItem === 3} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'Y' }} index={4} active={activeItem === 4} onClick={setActiveItem} />
          <Filter label={{ first: 'ALL' }} index={5} active={activeItem === 5} onClick={setActiveItem} />
        </div>
        <ChartMenu activeChart={activeChart} setActiveChart={setActiveChart} />
      </div>
      <VictoryChart
        theme={theme}
        width={layoutWidth * 0.8}
        height={400}
        animate={{ duration: 300, easing: 'cubicOut' }}
        scale={{ x: 'time' }}
        containerComponent={
          <VictoryZoomContainer responsive={false} zoomDimension="x" zoomDomain={zoomDomain} onZoomDomainChange={domain => setBrushDomain({ x: domain.x })} />
        }
      >
        <VictoryAxis />
        <VictoryAxis dependentAxis label="price" />
        <VictoryLine data={orders} x="timestamp" y="price" />
      </VictoryChart>
      <VictoryChart
        theme={theme}
        padding={{ top: 0, left: 50, right: 50, bottom: 30 }}
        width={layoutWidth * 0.8}
        height={100}
        scale={{ x: 'time' }}
        containerComponent={
          <VictoryBrushContainer
            responsive={false}
            brushDimension="x"
            brushDomain={brushDomain}
            onBrushDomainChange={domain => setZoomDomain({ x: domain.x })}
            brushComponent={<CustomBrush />}
            brushStyle={brushStyle}
          />
        }
      >
        <VictoryAxis tickFormat={x => new Date(x).toLocaleDateString()} />
        <VictoryLine data={orders} x="timestamp" y="price" />
      </VictoryChart>
    </>
  )
}
