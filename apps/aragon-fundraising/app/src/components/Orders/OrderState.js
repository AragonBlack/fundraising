import React from 'react'
import { IconCheck, IconEllipsis, GU } from '@aragon/ui'
import { Order } from '../../constants'
import overIcon from '../../assets/OverIcon.svg'

export default ({ state }) => {
  let icon
  if (state === Order.state.CLAIMED) {
    icon = <IconCheck size="medium" color="#2CC68F" />
  } else if (state === Order.state.OVER) {
    icon = <img src={overIcon} />
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
