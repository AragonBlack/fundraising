import React from 'react'
import { Info, useLayout, GU, Link } from '@aragon/ui'

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
        You might need some Rinkeby DAI or ANT which you can get by visting <Link href="https://faucet.aragon.black/">https://faucet.aragon.black/</Link>.
      </p>
    </Info>
  )
}
