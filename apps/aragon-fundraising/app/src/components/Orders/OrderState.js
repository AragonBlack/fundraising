import React from 'react'
import { IconCheck, IconEllipsis, GU, Help } from '@aragon/ui'
import { Order } from '../../constants'
import overIcon from '../../assets/OverIcon.svg'

const HELPS = {
  CLAIMED: 'This order has been claimed. Its traded tokens have been returned.',
  OVER: 'The batch including this order is now over. This order can be claimed.',
  PENDING: 'The batch including this order is not yet over.',
}

export default ({ state }) => {
  let icon
  let help
  if (state === Order.state.CLAIMED) {
    icon = <IconCheck size="medium" color="#2CC68F" />
    help = HELPS.CLAIMED
  } else if (state === Order.state.OVER) {
    icon = <img src={overIcon} />
    help = HELPS.OVER
  } else if (state === Order.state.PENDING) {
    icon = <IconEllipsis size="medium" color="#6D777B" />
    help = HELPS.PENDING
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
      <p
        css={`
          margin-top: ${0.4 * GU}px;
          margin-left: ${0.5 * GU}px;
        `}
      >
        <Help>{help}</Help>
      </p>
    </>
  )
}
