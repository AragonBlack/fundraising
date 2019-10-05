import React from 'react'
import { Info, GU } from '@aragon/ui'

const Information = () => {
  return (
    <div
      css={`
        margin-top: ${4 * GU}px;
      `}
    >
      <Info.Action>If the presale campaign fails, you can get refunded. If the presale campaign succeeds, your shares will be vested.</Info.Action>
    </div>
  )
}

export default Information
