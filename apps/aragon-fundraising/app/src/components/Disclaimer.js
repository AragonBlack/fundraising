import React from 'react'
import { Info, useLayout, GU } from '@aragon/ui'

export default () => {
  const { layoutName } = useLayout()

  return (
    <Info
      mode="warning"
      css={`
        margin: 0 ${layoutName === 'small' ? 3 * GU : 0}px ${3 * GU}px;
      `}
    >
      <p>
        This demo of Aragon Fundraising is still in the experimental phase. It's a peek into the capabilities of the final version and we are looking forward to
        your feedback.
      </p>
      <p>
        You might need some Rinkeby DAI or ANT which you can get by visting <a href="https://faucet.aragon.black/">https://faucet.aragon.black/</a>
      </p>
      <p>Expect daily frontend updates and future smart contract updates.</p>
    </Info>
  )
}
