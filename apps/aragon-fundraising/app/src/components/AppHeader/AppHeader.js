import React from 'react'
import PropTypes from 'prop-types'
import { GU, useTheme, useLayout } from '@aragon/ui'

function AppHeader({ heading, action }) {
  const theme = useTheme()
  const { width } = useLayout()
  return (
    <div
      css={
        width === 360
          ? `
        padding: 1rem;
        background: white;
        margin-bottom: 0.5rem;
        box-shadow: 0px 2px 3px rgba(217, 222, 231, 0.5);
      `
          : `
        padding-top: ${3 * GU}px;
        padding-bottom: ${3 * GU}px;
      `
      }
    >
      <div
        css={`
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: ${5 * GU}px;
        `}
      >
        <div>
          {typeof heading === 'string' ? (
            <h1
              css={`
                font-size: 26px;
                color: ${theme.content};
              `}
            >
              {heading}
            </h1>
          ) : (
            heading
          )}
        </div>
        <div>{action}</div>
      </div>
    </div>
  )
}

AppHeader.propTypes = {
  heading: PropTypes.node,
  action: PropTypes.node,
}

export default AppHeader
