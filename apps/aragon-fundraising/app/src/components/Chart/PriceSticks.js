import React, { useState, useEffect } from 'react'
import { useAppState } from '@aragon/api-react'
import { useLayout } from '@aragon/ui'
import { VictoryChart, VictoryCandlestick, VictoryAxis, VictoryZoomContainer } from 'victory'
import minBy from 'lodash.minBy'
import maxBy from 'lodash.maxBy'
import { computeOCHL } from './utils'
import theme from './theme'
import Navbar, { Filter } from './Navbar'
import CustomCandle from './CustomCandle'

export default ({ activeChart, setActiveChart }) => {
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const lastOrder = Math.max(...timestamps)
  const [zoomDomain, setZoomDomain] = useState({ x: [firstOrder, lastOrder] })
  const [activeItem, setActiveItem] = useState(1)
  const [data, setData] = useState({
    [activeItem]: computeOCHL(orders, activeItem), // initial values
  })
  const { layoutName, layoutWidth } = useLayout()
  // TODO: giving wrong layout width when `layputName === 'small'`
  const width = layoutName !== 'small' ? layoutWidth * 0.8 : layoutWidth

  useEffect(() => {
    // progressively compute OCHLs
    if (!data[activeItem]) {
      setData({
        ...data,
        [activeItem]: computeOCHL(orders, activeItem),
      })
    }
  }, [activeItem])

  useEffect(() => {
    if (data[activeItem]) {
      // console.log(Object.keys(data).map(d => data[d].map(r => new Date(r.x).toLocaleString())))
      // console.log(data[activeItem])
      const minRange = data[activeItem] ? minBy(data[activeItem], d => d.x).x : firstOrder
      const maxRange = data[activeItem] ? maxBy(data[activeItem], d => d.x).x : lastOrder
      // console. log(minRange)
      // console.log(maxRange)
      // setZoomDomain({ x: [minRange, maxRange] })
      setZoomDomain({ x: [minRange, maxRange] })
    }
  }, [data, activeItem])

  // when orders are loaded and/or updated, compute the OCHL of the selected filter
  useEffect(() => {
    setData({
      ...data,
      [activeItem]: computeOCHL(orders, activeItem),
    })
  }, [orders])

  return (
    <>
      <Navbar activeChart={activeChart} setActiveChart={setActiveChart}>
        <Filter label={{ first: '15', second: 'm' }} index={0} active={activeItem === 0} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'H' }} index={1} active={activeItem === 1} onClick={setActiveItem} />
        <Filter label={{ first: '4', second: 'H' }} index={2} active={activeItem === 2} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'D' }} index={3} active={activeItem === 3} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'W' }} index={4} active={activeItem === 4} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'M' }} index={5} active={activeItem === 5} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'Y' }} index={6} active={activeItem === 6} onClick={setActiveItem} />
      </Navbar>
      <VictoryChart
        theme={theme}
        width={width}
        height={400}
        // animate={{ duration: 300, easing: 'cubicOut' }}
        scale={{ x: 'time' }}
        containerComponent={
          <VictoryZoomContainer
            responsive={false}
            zoomDimension="x"
            zoomDomain={zoomDomain}
            onZoomDomainChange={domain => {
              console.log(domain)
              return setZoomDomain({ x: domain.x })
            }}
          />
        }
      >
        <VictoryAxis />
        <VictoryAxis dependentAxis label="price" />
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
