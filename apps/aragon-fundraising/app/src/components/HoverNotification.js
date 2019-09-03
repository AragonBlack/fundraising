import React, { useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { font } from '@aragon/ui'

const HoverNotification = styled.div`
  position: absolute;
  z-index: 5;
  border-radius: 4px;
  background: #f5f5fe;
  border-left: 2px solid #7c80f2;
  margin: 2rem 1rem;
  padding: 1rem;
  width: 350px;
  span {
    ${font({ size: 'small', weight: 'normal' })}
    color: #7C80F2;
  }
`

HoverNotification.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  copy: PropTypes.string,
}

HoverNotification.defaultProps = {
  copy: '',
}

const WrapperHoverNotification = ({ children, copy }) => {
  const [isHovering, setIsHovering] = useState(false)
  return (
    <div onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} style={{ display: 'inline-flex' }}>
      {children}
      {isHovering && (
        <HoverNotification>
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
