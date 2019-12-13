import React, { useState, useEffect, useRef } from 'react'
import { useAppState } from '@aragon/api-react'
import { theme } from '@aragon/ui'
import Plotly from 'plotly.js-finance-dist'
import createPlotlyComponent from 'react-plotly.js/factory'
import { computeOCHL } from './utils'
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
  const rangeLayout = {
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
  }
  // *****************************
  // internal state
  // *****************************
  const [activeItem, setActiveItem] = useState(1)
  const [tooltipData, setTooltipData] = useState(null)
  const [data, setData] = useState({
    [activeItem]: computeOCHL(orders, activeItem), // initial values
  })

  const plot = useRef(null)

  // *****************************
  // effects
  // *****************************
  // compute OHCL when activeItem filter changes
  useEffect(() => {
    // progressively compute OCHLs
    if (!data[activeItem]) {
      setData({
        ...data,
        [activeItem]: computeOCHL(orders, activeItem),
      })
    }
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
        <Filter label={{ first: '15', second: 'm' }} index={0} active={activeItem === 0} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'H' }} index={1} active={activeItem === 1} onClick={setActiveItem} />
        <Filter label={{ first: '4', second: 'H' }} index={2} active={activeItem === 2} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'D' }} index={3} active={activeItem === 3} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'W' }} index={4} active={activeItem === 4} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'M' }} index={5} active={activeItem === 5} onClick={setActiveItem} />
        <Filter label={{ first: '1', second: 'Y' }} index={6} active={activeItem === 6} onClick={setActiveItem} />
      </Navbar>
      <Plot
        ref={plot}
        css={style}
        data={[trace]}
        layout={rangeLayout}
        config={config}
        onHover={data => setTooltipData(data.points[0])}
        onUnhover={() => setTooltipData(null)}
      />
      {tooltipData && <Tooltip point={tooltipData} />}
    </>
  )
}
