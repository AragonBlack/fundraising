import React, { useEffect, useRef, useState } from 'react'
import { useAppState } from '@aragon/api-react'
import { useLayout } from '@aragon/ui'
import subHours from 'date-fns/subHours'
import subDays from 'date-fns/subDays'
import subWeeks from 'date-fns/subWeeks'
import subMonths from 'date-fns/subMonths'
import subYears from 'date-fns/subYears'
import Plotly from 'plotly.js-basic-dist'
import createPlotlyComponent from 'react-plotly.js/factory'
import Navbar, { Filter } from './Navbar'
import { trace, layout, config } from './config'

const Plot = createPlotlyComponent(Plotly)

export default ({ activeChart, setActiveChart }) => {
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const lastOrder = Math.max(...timestamps)
  const range = [firstOrder, lastOrder]
  const [activeItem, setActiveItem] = useState(1)
  const { layoutName, layoutWidth } = useLayout()
  // TODO: giving wrong layout width when `layputName === 'small'`
  const width = layoutName !== 'small' ? layoutWidth * 0.8 : layoutWidth

  const plot = useRef(null)

  useEffect(() => {
    if (plot?.current?.el) {
      const functionToCall = [subHours, subDays, subWeeks, subMonths, subYears, x => firstOrder][activeItem]
      const start = functionToCall(lastOrder, 1)
      try {
        Plotly.relayout(plot.current.el, 'xaxis.range', [start, lastOrder])
      } catch {}
    }
  }, [activeItem])

  return (
    <>
      <Navbar activeChart={activeChart} setActiveChart={setActiveChart}>
        <Filter label={{ first: '1', second: 'H' }} index={0} active={activeItem === 0} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'D' }} index={1} active={activeItem === 1} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'W' }} index={2} active={activeItem === 2} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'M' }} index={3} active={activeItem === 3} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'Y' }} index={4} active={activeItem === 4} onClick={setActiveItem} />
        <Filter label={{ first: 'ALL' }} index={5} active={activeItem === 5} onClick={setActiveItem} />
      </Navbar>
      <Plot ref={plot} data={[trace(timestamps, orders.map(o => o.price.toFixed(2, 1)))]} layout={layout(range)} config={config} useResizeHandler />
    </>
  )
}
