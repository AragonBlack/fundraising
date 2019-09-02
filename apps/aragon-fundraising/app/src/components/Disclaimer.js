import React from 'react'
import { Info, Text } from '@aragon/ui'

export default () => (
  <Info mode="warning" css="margin-top: 1.5rem;">
    <Text>
      This demo of Aragon Fundraising is still in the experimental phase. It's a peek into the capabilities of the final version and we are looking forward to
      your feedback.
    </Text>
    <Text css="display: block;">
      You might need some Rinkeby DAI or ANT which you can get by visiting the following site:{' '}
      <a href="https://faucet.aragon.black/">https://faucet.aragon.black/</a>
    </Text>
    <Text css="display: block;">Expect daily frontend updates and future smart contract updates.</Text>
  </Info>
)
