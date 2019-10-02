import React from 'react'
import { useAppState } from '@aragon/api-react'
import { Info } from '@aragon/ui'

const Information = ({ isBuyOrder, slippage }) => {
  // *****************************
  // background script state
  // *****************************
  const {
    constants: { PCT_BASE },
  } = useAppState()
  const slippagePct = slippage.div(PCT_BASE).times(100).toFixed(2)

  return (
    <div
      css={`
        margin-top: 2rem;
      `}
    >
      <Info.Action title="Slippage">
        <p>
          The exact return of your order may differ from the one indicated if other users open buy or sell orders simultaneously. In any case you can be
          assured that the price slippage won't exceed <b>{slippagePct}%</b>.
        </p>
      </Info.Action>
    </div>
  )
}

export default Information
