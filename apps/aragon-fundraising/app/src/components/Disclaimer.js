import React from 'react'
import { Info, Text, useLayout } from '@aragon/ui'

export default () => {
  const { layoutName } = useLayout()

  return (
    <Info mode="warning" css={layoutName === 'small' ? '' : 'margin-top: 1.5rem;'}>
      <Text>
        This demo of Aragon Fundraising is still in the experimental phase. It's a peek into the capabilities of the final version and we are looking forward to
        your feedback.
      </Text>
      <Text css="display: block;">
        You might need some Rinkeby DAI or ANT which you can get by visting{' '}
        <a href="https://faucet.aragon.black/">https://faucet.aragon.black/</a>
      </Text>
      <Text css="display: block;">Expect daily frontend updates and future smart contract updates.</Text>
    </Info>
  )
}
