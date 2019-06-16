import { ButtonIcon, IconMenu } from '@aragon/ui'
import React from 'react'

export default props => (
  <ButtonIcon
    {...props}
    css={`
      float: right;
      margin-right: 1rem;
      margin-bottom: 0.5rem;
    `}
    label="Open tab menu"
  >
    <IconMenu />
  </ButtonIcon>
)
