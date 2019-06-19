import React from 'react'
import { theme } from '../../theme-legacy'
import Badge from './Badge'

const Identity = props => (
  <Badge
    shape="compact"
    background={theme.badgeIdentityBackground}
    foreground={theme.badgeIdentityForeground}
    {...props}
  />
)

export default Identity
