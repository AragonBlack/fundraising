import React, { useState } from 'react'
import PropTypes from 'prop-types'
import styled, { css } from 'styled-components'
import { font } from '../../utils/styles'

// TODO: standarize the z-index across all components
const baseStyles = css`
  position: absolute;
  z-index: 5;
  border-radius: 4px;
  background: #f5f5fe;
  border-left: 2px solid #7c80f2;
  margin: -0.25rem 2rem;
  padding: 1rem;
  span {
    ${font({ size: 'small', weight: 'normal' })}
    color: #7C80F2;
  }
`

const HoverNotification = styled.div`
  ${baseStyles}
`

HoverNotification.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  copy: PropTypes.string,
}

HoverNotification.defaultProps = {
  copy: '',
}

const WrapperHoverNotification = ({ children, copy, hoverSettings: { width: hoverWidth = 350, height: hoverHeight = 150 } }) => {
  const [isHovering, setIsHovering] = useState(false)
  return (
    <div onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} style={{ display: 'inline-flex' }}>
      {children}
      {isHovering && (
        <HoverNotification
          css={`
            width: ${hoverWidth}px;
            height: ${hoverHeight}px;
          `}
        >
          <span>{copy}</span>
        </HoverNotification>
      )}
    </div>
  )
}

WrapperHoverNotification.propTypes = {
  ...HoverNotification.propTypes,
  children: PropTypes.node.isRequired,
  hoverSettings: PropTypes.shape({
    width: PropTypes.number,
    height: PropTypes.number,
  }),
}

WrapperHoverNotification.defaultProps = {
  ...HoverNotification.defaultProps,
  children: null,
  hoverSettings: {},
}

export default WrapperHoverNotification
