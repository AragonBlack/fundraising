import React from 'react'
import { Box } from '@aragon/ui'

export default ({ point }) => {
  // calculate position of the tooltip, thanks to plotly utils

  // l2p stands for linear to pixel
  let top = 250 // default value
  // it's a linear chart (e.g. price history)
  if (point.y) top = point.yaxis.l2p(point.y) + point.yaxis._offset
  // it's a candlestick chart, we need to calculate the center of OH
  else top = point.yaxis.l2p((point.open + point.close) / 2) + point.yaxis._offset

  // d2p stands for date to pixel
  const left = point.xaxis.d2p(point.x) + point.xaxis._offset

  return (
    <Box
      css={`
        position: absolute;
        top: ${top}px;
        left: ${left}px;
        pointer-events: none;
        width: 200px;
      `}
    >
      {point.y ? (
        <>
          <h1>{point.x}</h1>
          <p>Price: {point.y}</p>
        </>
      ) : (
        <>
          <h1>{point.x}</h1>
          <p>Open: {point.open}</p>
          <p>Close: {point.close}</p>
          <p>High: {point.high}</p>
          <p>Low: {point.low}</p>
        </>
      )}
    </Box>
  )
}
