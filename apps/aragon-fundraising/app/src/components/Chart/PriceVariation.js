import React, { useState, useEffect, useRef } from 'react'
import { useAppState } from '@aragon/api-react'
import Plotly from 'plotly.js-finance-dist'
import createPlotlyComponent from 'react-plotly.js/factory'
import { computeOCHL } from './utils'
import { layout as defaultLayout, config, style } from './setup'
import Navbar, { Filter } from './Navbar'
import Tooltip from './Tooltip'
import addMinutes from 'date-fns/addMinutes'
import subMinutes from 'date-fns/subMinutes'
import addHours from 'date-fns/addHours'
import subHours from 'date-fns/subHours'
import addDays from 'date-fns/addDays'
import subDays from 'date-fns/subDays'

const Plot = createPlotlyComponent(Plotly)

export default ({ activeChart, setActiveChart, theme }) => {
  // *****************************
  // context state
  // *****************************
  const { orders } = useAppState()
  const timestamps = orders.map(o => o.timestamp)
  const firstOrder = Math.min(...timestamps)
  const lastOrder = Math.max(...timestamps)

  // *****************************
  // internal state
  // *****************************
  const [activeItem, setActiveItem] = useState(1)
  const [tooltipData, setTooltipData] = useState(null)
  const [data, setData] = useState({
    [activeItem]: computeOCHL(orders, activeItem), // initial values
  })
  // initial layout, according to the activeItem
  const initialLayout = {
    ...defaultLayout,
    xaxis: {
      ...defaultLayout.xaxis,
      autorange: false,
      range: [subMinutes(lastOrder, 180), addMinutes(lastOrder, 20)],
      rangeslider: {
        ...defaultLayout.xaxis.rangeslider,
        range: [subDays(firstOrder, 1), addDays(lastOrder, 1)],
      },
    },
    plot_bgcolor: theme.surface,
    paper_bgcolor: theme.surface,
  }
  const [layout, setLayout] = useState(initialLayout)
  const plot = useRef(null)

  // *****************************
  // effects
  // *****************************
  const relayout = first => {
    if (plot?.current?.el) {
      try {
        // hacky, if we don't delete the traces, there is still some artefacts of the previous trace
        if (!first) Plotly.deleteTraces(plot.current.el, 0)
        Plotly.relayout(plot.current.el, layout)
      } catch {}
    }
  }

  const computeRange = activeItem => {
    // calculate the range according to the selected filter
    let start, end
    switch (activeItem) {
      case 0:
      default:
        start = subMinutes(lastOrder, 90)
        end = addMinutes(lastOrder, 10)
        break
      case 1:
        start = subMinutes(lastOrder, 180)
        end = addMinutes(lastOrder, 20)
        break
      case 2:
        start = subHours(lastOrder, 9)
        end = addHours(lastOrder, 1)
        break
      case 3:
        start = subDays(lastOrder, 9)
        end = addDays(lastOrder, 1)
        break
    }
    // update the layout with the new range
    setLayout({
      ...layout,
      xaxis: {
        ...layout.xaxis,
        range: [start, end],
      },
    })
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
    computeRange(activeItem)
    relayout(false)
  }, [activeItem])

  // when orders are loaded and/or updated, compute the OCHL of the selected filter
  useEffect(() => {
    setData({
      ...data,
      [activeItem]: computeOCHL(orders, activeItem),
    })
  }, [orders])

  // update graph color when theme is changed
  useEffect(() => {
    setLayout({ ...layout, plot_bgcolor: theme.surface, paper_bgcolor: theme.surface })
  }, [theme])

  // computed trace
  const trace = {
    type: 'candlestick',
    increasing: { line: { color: theme.positive } },
    decreasing: { line: { color: theme.negative } },
    ...data[activeItem],
    hoverinfo: 'none',
    line: { width: 3 },
    whiskerwidth: 0.3,
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
        layout={layout}
        config={config}
        onHover={data => setTooltipData(data.points[0])}
        onUnhover={() => setTooltipData(null)}
        onInitialized={() => relayout(true)}
      />
      {tooltipData && <Tooltip point={tooltipData} />}
    </>
  )
}
