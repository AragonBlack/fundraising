import React from 'react'
import { IconCheck, IconClock, IconEllipsis } from '@aragon/ui'
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
      <p css="margin-top: 0.20rem; margin-left: 0.25rem;">{state.charAt(0) + state.slice(1).toLowerCase()}</p>
    </>
  )
}
