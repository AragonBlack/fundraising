import React from 'react'

export default props => {
  const { x, candleWidth, open, close, high, low, style } = props
  const defaultHeight = 2
  const candleHeight = Math.max(Math.abs(open - close), defaultHeight)
  const candley = Math.min(open, close)
  const wickx = x + candleWidth / 2
  return (
    <g role="presentation">
      <line x1={wickx} y1={candley} x2={wickx} y2={high - defaultHeight} style={style} />
      <line x1={wickx} y1={candley + candleHeight} x2={wickx} y2={low + defaultHeight} style={style} />
      <rect x={x} y={candley} width={candleWidth} height={candleHeight} style={style} />
    </g>
  )
}
