import React from 'react'
import { handleStyle } from './theme'

export default ({ x, y, width, height, style }) => {
  const handleWidth = 5
  const handleHeight = height / 3
  const leftx = x - handleWidth / 2
  const lefty = (height - handleHeight) / 2
  const rightx = x + width - handleWidth / 2
  const righty = lefty
  return (
    <g role="presentation">
      <rect x={x} y={y} width={width} height={height} style={style} />
      <rect x={leftx} y={lefty} width={handleWidth} height={handleHeight} style={handleStyle} />
      <rect x={rightx} y={righty} width={handleWidth} height={handleHeight} style={handleStyle} />
    </g>
  )
}
