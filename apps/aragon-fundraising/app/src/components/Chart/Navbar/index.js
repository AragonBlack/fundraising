import React from 'react'
import styled from 'styled-components'
import { GU } from '@aragon/ui'
import ChartMenu from './ChartMenu'
import Filter from './Filter'

export { Filter }

export default ({ activeChart, setActiveChart, children }) => {
  return (
    <Navbar>
      <div className="timeline">{children}</div>
      <ChartMenu activeChart={activeChart} setActiveChart={setActiveChart} />
    </Navbar>
  )
}

const Navbar = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: ${4 * GU}px;
  margin-right: ${6 * GU}px;
  margin-left: ${2 * GU}px;

  .timeline {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .item {
      font-weight: bold;
      font-size: 16px;
      margin-right: ${3 * GU}px;
      color: rgba(109, 119, 123, 0.7);
      &:hover {
        cursor: pointer;
        border-bottom: 2px solid #08bee5;
      }
      &.active {
        border-bottom: 2px solid #08bee5;
      }
      & > span:nth-child(1) {
        margin-right: ${0.5 * GU}px;
        color: black;
      }
    }
  }

  @media only screen and (max-width: 700px) {
    flex-direction: column-reverse;
    margin-top: ${4 * GU}px;
    margin-right: ${4 * GU}px;
    margin-left: ${4 * GU}px;

    .timeline {
      width: 100%;
      margin-top: ${4 * GU}px;
    }
    .item:last-child {
      margin-right: 0;
    }
  }
`
