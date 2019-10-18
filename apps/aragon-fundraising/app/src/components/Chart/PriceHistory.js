import React, { useEffect, useRef, useState } from 'react'
import { useAppState } from '@aragon/api-react'
import { useLayout } from '@aragon/ui'
import subHours from 'date-fns/subHours'
import subDays from 'date-fns/subDays'
import subWeeks from 'date-fns/subWeeks'
import subMonths from 'date-fns/subMonths'
import subYears from 'date-fns/subYears'
import Plotly from 'plotly.js-finance-dist'
import createPlotlyComponent from 'react-plotly.js/factory'
import { layout, config, style } from './setup'
import Navbar, { Filter } from './Navbar'
import Tooltip from './Tooltip'

const Plot = createPlotlyComponent(Plotly)

export default ({ activeChart, setActiveChart }) => {
  // *****************************
  // context state
  // *****************************
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const lastOrder = Math.max(...timestamps)
  const range = [firstOrder, lastOrder]

  // *****************************
  // internal state
  // *****************************
  const [activeItem, setActiveItem] = useState(5)
  const [tooltipData, setTooltipData] = useState(null)

  const plot = useRef(null)

  // *****************************
  // effects
  // *****************************
  // relayout when the activeItem filter is changed
  useEffect(() => {
    if (plot?.current?.el) {
      // only relayout if the chart is mounted (by updating the range)
      const functionToCall = [subHours, subDays, subWeeks, subMonths, subYears, x => firstOrder][activeItem]
      const start = functionToCall(lastOrder, 1)
      const range = [start, lastOrder]
      try {
        Plotly.relayout(plot.current.el, { 'xaxis.range': range })
      } catch {}
    }
  }, [activeItem])

  // computed trace
  const trace = {
    mode: 'lines+markers',
    line: { color: theme.accent },
    x: timestamps,
    y: orders.map(o => o.price.toFixed(2, 1)),
    hoverinfo: 'none',
  }

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
      <Plot
        ref={plot}
        css={style}
        data={[trace]}
        layout={layout(range)}
        config={config}
        onHover={data => setTooltipData(data.points[0])}
        onUnhover={() => setTooltipData(null)}
      />
      {tooltipData && <Tooltip point={tooltipData} />}
    </>
  )
}
