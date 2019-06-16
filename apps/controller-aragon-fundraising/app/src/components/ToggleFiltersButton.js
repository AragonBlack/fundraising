import React from 'react'
import { ButtonIcon, IconFilter } from '@aragon/ui'

export default props => (
  <ButtonIcon
    label="Toggle filters"
    {...props}
    css={`
      float: right;
      margin-right: 2rem;
      margin-bottom: 1rem;
    `}
  >
    <IconFilter />
  </ButtonIcon>
)
