import React, { useState, useEffect, useRef } from 'react'
import { useAppState } from '@aragon/api-react'
import { theme } from '@aragon/ui'
import Plotly from 'plotly.js-finance-dist'
import createPlotlyComponent from 'react-plotly.js/factory'
import { computeOCHL, getDay } from './utils'
import { layout, config, style } from './setup'
import Navbar, { Filter } from './Navbar'
import Tooltip from './Tooltip'
import addDays from 'date-fns/addDays'
import subDays from 'date-fns/subDays'
import subMonths from 'date-fns/subMonths'

const Plot = createPlotlyComponent(Plotly)

export default ({ activeChart, setActiveChart }) => {
  // *****************************
  // context state
  // *****************************
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const today = getDay(new Date())
  const oneMonthAgo = subMonths(today, 1)
  // start of the range is the lowest between the following
  // - first order minus one day
  // - one month before today
  const start = Math.min(subDays(getDay(firstOrder), 1), oneMonthAgo)
  // end of the range is today plus one day
  const end = addDays(getDay(today), 1)

  // *****************************
  // internal state
  // *****************************
  const [activeItem, setActiveItem] = useState(1)
  const [tooltipData, setTooltipData] = useState(null)
  const [data, setData] = useState({
    [activeItem]: computeOCHL(orders, activeItem), // initial values
  })
  // with the start/end calculation, we are sure to have at least a one month range
  const [range, setRange] = useState([start, end])
  const rangeLayout = () => ({
    ...layout,
    xaxis: {
      ...layout.xaxis,
      autorange: false,
      range,
      rangeslider: {
        ...layout.xaxis.rangeslider,
        range,
      },
    },
  })

  const plot = useRef(null)

  // *****************************
  // effects
  // *****************************
  const update = ({ layout }) => {
    setRange(layout.xaxis.range)
  }
  const relayout = () => {
    if (plot?.current?.el) {
      try {
        Plotly.relayout(plot.current.el, rangeLayout())
      } catch {}
    }
  }
  // compute OHCL when activeItem filter changes
  useEffect(() => {
    // progressively compute OCHLs
    if (!data[activeItem]) {
      setData({
        ...data,
        [activeItem]: computeOCHL(orders, activeItem),
      })
    }
    setRange([start, end])
    relayout()
  }, [activeItem])

  // when orders are loaded and/or updated, compute the OCHL of the selected filter
  useEffect(() => {
    setData({
      ...data,
      [activeItem]: computeOCHL(orders, activeItem),
    })
  }, [orders])

  // computed trace
  const trace = {
    type: 'candlestick',
    increasing: { line: { color: theme.positive } },
    decreasing: { line: { color: theme.negative } },
    ...data[activeItem],
    hoverinfo: 'none',
  }

  return (
    <>
      <Navbar activeChart={activeChart} setActiveChart={setActiveChart}>
        <Filter label={{ first: '10', second: 'm' }} index={0} active={activeItem === 0} onClick={setActiveItem} />
        <Filter label={{ first: '20', second: 'm' }} index={1} active={activeItem === 1} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'H' }} index={2} active={activeItem === 2} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'D' }} index={3} active={activeItem === 3} onClick={setActiveItem} />
      </Navbar>
      <Plot
        ref={plot}
        css={style}
        data={[trace]}
        layout={rangeLayout()}
        config={config}
        onHover={data => setTooltipData(data.points[0])}
        onUnhover={() => setTooltipData(null)}
        onInitialized={() => relayout()}
        onUpdate={data => update(data)}
      />
      {tooltipData && <Tooltip point={tooltipData} />}
    </>
  )
}
