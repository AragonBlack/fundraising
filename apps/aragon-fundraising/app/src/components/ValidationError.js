import React from 'react'
import { GU, Info } from '@aragon/ui'

const ValidationError = ({ messages }) => {
  return (
    <Info
      mode="error"
      css={`
        margin-top: ${2 * GU}px;
      `}
    >
      {messages.map((message, i) => (
        <p
          key={i}
          css={`
            margin-top: ${i !== 0 ? `${2 * GU}px;` : '0'};
          `}
        >
          {message}
        </p>
      ))}
    </Info>
  )
}

export default ValidationError
