import React from 'react'
import { Info } from '@aragon/ui'

export default () => {
  return (
    <div
      css={`
        margin-top: 2rem;
      `}
    >
      <Info.Action>
        The presale did not reach its goal. You can thus request refund for your contributions. If you have made multiple contributions, you should request
        refund for each of them.
      </Info.Action>
    </div>
  )
}
