import React, { useState, useEffect } from 'react'
import { useAppState } from '@aragon/api-react'
import { useLayout } from '@aragon/ui'
import { VictoryChart, VictoryCandlestick, VictoryAxis, VictoryZoomContainer } from 'victory'
import minBy from 'lodash/minBy'
import maxBy from 'lodash/maxBy'
import { computeOCHL } from './utils'
import theme from './theme'
import Filter from './Filter'
import ChartMenu from './ChartMenu'
import CustomCandle from './CustomCandle'

export default ({ activeChart, setActiveChart }) => {
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const lastOrder = Math.max(...timestamps)
  const [zoomDomain, setZoomDomain] = useState({ x: [firstOrder, lastOrder] })
  const [activeItem, setActiveItem] = useState(1)
  const [data, setData] = useState({})
  const { layoutWidth } = useLayout()

  useEffect(() => {
    if (!data[activeItem]) {
      setData({
        ...data,
        [activeItem]: computeOCHL(orders, activeItem),
      })
    }
  }, [activeItem])

  useEffect(() => {
    console.log(Object.keys(data).map(d => data[d].map(r => new Date(r.x).toLocaleString())))
    console.log(data[activeItem])
    const minRange = data[activeItem] ? minBy(data[activeItem], d => d.x).x : firstOrder
    const maxRange = data[activeItem] ? maxBy(data[activeItem], d => d.x).x : lastOrder
    setZoomDomain({ x: [minRange, maxRange] })
  }, [data])

  useEffect(() => {
    setData({
      [activeItem]: computeOCHL(orders, activeItem),
    })
  }, [orders])

  return (
    <>
      <div className="navbar">
        <div className="timeline">
          <Filter label={{ first: '15', second: 'm' }} index={0} active={activeItem === 0} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'H' }} index={1} active={activeItem === 1} onClick={setActiveItem} />
          <Filter label={{ first: '4', second: 'H' }} index={2} active={activeItem === 2} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'D' }} index={3} active={activeItem === 3} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'W' }} index={4} active={activeItem === 4} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'M' }} index={5} active={activeItem === 5} onClick={setActiveItem} />
          <Filter label={{ first: '1', second: 'Y' }} index={6} active={activeItem === 6} onClick={setActiveItem} />
        </div>
        <ChartMenu activeChart={activeChart} setActiveChart={setActiveChart} />
      </div>
      <VictoryChart
        theme={theme}
        width={layoutWidth * 0.8}
        height={400}
        // animate={{ duration: 300, easing: 'cubicOut' }}
        scale={{ x: 'time' }}
        containerComponent={
          <VictoryZoomContainer responsive={false} zoomDimension="x" zoomDomain={zoomDomain} onZoomDomainChange={domain => setZoomDomain({ x: domain.x })} />
        }
      >
        <VictoryAxis />
        <VictoryAxis minDomain={0} dependentAxis label="price" />
        <VictoryCandlestick
          animate={{
            duration: 300,
            easing: 'cubicOut',
            onLoad: { duration: 300, easing: 'cubicOut' },
          }}
          theme={theme}
          data={data[activeItem] ?? []}
          dataComponent={<CustomCandle />}
        />
      </VictoryChart>
    </>
  )
}
