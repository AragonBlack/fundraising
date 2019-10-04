import React from 'react'
import { IconCheck, IconClock, IconEllipsis, GU } from '@aragon/ui'
import { Order } from '../../constants'

export default ({ state }) => {
  let icon
  if (state === Order.state.CLAIMED) {
    icon = <IconCheck size="medium" color="#2CC68F" />
  } else if (state === Order.state.OVER) {
    icon = <IconClock size="medium" color="#08BEE5" />
  } else if (state === Order.state.PENDING) {
    icon = <IconEllipsis size="medium" color="#6D777B" />
  }
  return (
    <>
      {icon}
      <p
        css={`
          margin-top: ${0.4 * GU}px;
          margin-left: ${0.5 * GU}px;
        `}
      >
        {state.charAt(0) + state.slice(1).toLowerCase()}
      </p>
    </>
  )
}
