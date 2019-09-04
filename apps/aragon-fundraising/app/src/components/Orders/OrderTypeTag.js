import React from 'react'
import { Order } from '../../constants'

export default ({ type }) => {
  const bgColor = type === Order.type.BUY ? 'rgba(204, 189, 244, 0.3)' : 'rgb(255, 212, 140, 0.3)'
  const color = type === Order.type.BUY ? '#7546f2' : '#f08658'
  return (
    <div
      css={`
        display: inline-block;
        border-radius: 100px;
        background-color: ${bgColor};
        padding: 2px 2rem;
        text-transform: uppercase;
        color: ${color};
        font-size: 12px;
        font-weight: 700;
      `}
    >
      {type}
    </div>
  )
}
