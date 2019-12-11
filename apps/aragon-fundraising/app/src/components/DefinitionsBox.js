import React from 'react'
import { Box, GU, useTheme } from '@aragon/ui'

const DefinitionsBox = ({ heading, definitions }) => {
  const theme = useTheme()
  return (
    <Box heading={heading}>
      <ul>
        {definitions.map(({ label, content }, index) => (
          <li
            key={index}
            css={`
              display: flex;
              justify-content: space-between;
              list-style: none;
              color: ${theme.surfaceContent};
              & + & {
                margin-top: ${2 * GU}px;
              }
              > span:nth-child(1) {
                color: ${theme.surfaceContentSecondary};
              }
              > span:nth-child(2) {
                // “:” is here for accessibility reasons, we can hide it
                opacity: 0;
                width: 10px;
              }
              > span:nth-child(3) {
                flex-shrink: 1;
              }
              > strong {
                text-transform: uppercase;
              }
            `}
          >
            <span>{label}</span>
            <span>:</span>
            {content}
          </li>
        ))}
      </ul>
    </Box>
  )
}

export default DefinitionsBox
