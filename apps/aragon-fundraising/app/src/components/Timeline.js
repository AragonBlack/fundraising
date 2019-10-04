import React from 'react'
import PropTypes from 'prop-types'
import { BREAKPOINTS, Box, GU, Tag, textStyle, useLayout, useTheme } from '@aragon/ui'

const DOT_SIZE = 3.5 * GU
const DOT_VERTICAL_SHIFT = 0.5 * GU

function Timeline({ title, steps }) {
  const { layoutName } = useLayout()
  return (
    <Box heading={title} padding={0}>
      <div
        css={`
          display: flex;
          flex-direction: ${layoutName === 'small' ? 'column' : 'row'};
          padding: ${4 * GU}px ${layoutName === 'small' ? 3 * GU : 5 * GU}px;
        `}
      >
        {steps.map(([title, date, description], index) => (
          <TimelineStep
            key={index}
            date={date}
            description={description}
            direction={layoutName === 'small' ? 'vertical' : 'horizontal'}
            first={index === 0}
            last={index === steps.length - 1}
            title={title}
            css="width: 100%"
          />
        ))}
      </div>
    </Box>
  )
}

Timeline.propTypes = {
  steps: PropTypes.array.isRequired,
  title: PropTypes.string,
}

Timeline.defaultProps = {
  title: 'Timeline',
}

function TimelineStep({ title, date, description, first, last, direction, ...props }) {
  const theme = useTheme()
  const { layoutName } = useLayout()
  return (
    <section
      {...props}
      css={`
        position: relative;
        padding-left: ${direction === 'vertical' ? 6 * GU : 0}px;
        & + & {
          padding-top: ${layoutName === 'small' ? 3 * GU : 0}px;
        }
      `}
    >
      <h1
        css={`
          height: ${layoutName === 'small' ? 'auto' : `${7.5 * GU}px`};
          padding-right: ${2 * GU}px;
          color: ${theme.surfaceContentSecondary};
          ${textStyle('label1')};
        `}
      >
        {title}
      </h1>
      <TimelineSegment first={first} last={last} direction={direction} />
      <div
        css={`
          padding: ${direction === 'horizontal' || date !== 0 ? 2 * GU : 0}px 0;
        `}
      >
        {date !== 0 && <Tag mode="identifier">{new Date(date).toLocaleDateString()}</Tag>}
      </div>
      <p
        css={`
          padding-right: ${2 * GU}px;
        `}
      >
        {description}
      </p>
    </section>
  )
}

function TimelineSegment({ first, last, direction }) {
  const theme = useTheme()

  return direction === 'vertical' ? (
    <div
      css={`
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        width: ${DOT_SIZE}px;
      `}
    >
      <div
        css={`
          position: absolute;
          top: ${first ? DOT_SIZE / 2 : 0}px;
          bottom: ${last ? 'auto' : '0'};
          left: calc(50% - 0.5px);
          right: auto;
          width: 1px;
          height: ${last ? `${3 * GU + DOT_SIZE / 2 - DOT_VERTICAL_SHIFT}px` : 'auto'};
          background: ${theme.border};
        `}
      />
      <div
        css={`
          position: absolute;
          top: ${-DOT_VERTICAL_SHIFT + (first ? 0 : 3 * GU)}px;
        `}
      >
        <TimelineDot />
      </div>
    </div>
  ) : (
    <div
      css={`
        position: relative;
        height: ${3.5 * GU}px;
      `}
    >
      <div
        css={`
          position: absolute;
          top: calc(50% - 0.5px);
          left: ${first ? 1.75 * GU : 0}px;
          right: ${last ? 'auto' : '0'};
          bottom: auto;
          width: ${last ? `${1.75 * GU}px` : 'auto'};
          height: 1px;
          background: ${theme.border};
        `}
      />
      <TimelineDot />
    </div>
  )
}

function TimelineDot() {
  const theme = useTheme()
  return (
    <div
      css={`
        position: relative;
        width: ${DOT_SIZE}px;
        height: ${DOT_SIZE}px;
      `}
    >
      <div
        css={`
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: ${theme.accent.alpha(0.18)};
        `}
      >
        <div
          css={`
            width: ${DOT_SIZE / (7 / 3)}px;
            height: ${DOT_SIZE / (7 / 3)}px;
            border-radius: 50%;
            background: linear-gradient(45deg, ${theme.accentEnd} 0%, ${theme.accentStart} 100%);
          `}
        />
      </div>
    </div>
  )
}

export default Timeline
