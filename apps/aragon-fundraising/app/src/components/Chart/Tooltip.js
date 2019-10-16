import React from 'react'
import { Box } from '@aragon/ui'

export default ({ point }) => {
  // calculate position of the tooltip, thanks to plotly utils
  // l2p stands for linear to pixel

  const top = point.y ? point.yaxis.l2p(point.y) + point.yaxis._offset : 250
  // d2p stands for date to pixel
  const left = point.xaxis.d2p(point.x) + point.xaxis._offset
  return (
    <Box
      css={`
        position: absolute;
        top: ${top}px;
        left: ${left}px;
        pointer-events: none;
      `}
    >
      {point.open ? (
        <>
          <h1>{point.x}</h1>
          <p>Open: {point.open}</p>
          <p>Close:{point.close}</p>
          <p>High: {point.high}</p>
          <p>Low: {point.low}</p>
        </>
      ) : (
        <>
          <h1>{point.x}</h1>
          <p>Price: {point.y}</p>
        </>
      )}
    </Box>
  )
}
