import React from 'react'
import styled from 'styled-components'
import { GU } from '@aragon/ui'
import EmptyOrders from '../assets/EmptyOrders.png'

export default ({ message }) => (
  <EmptyState>
    <img src={EmptyOrders} alt="" width="176" height="151" />
    <p
      css={`
        font-size: 24px;
        margin-top: ${2 * GU}px;
      `}
    >
      {message}
    </p>
  </EmptyState>
)

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 500px;

  border-radius: 4px;
  border-style: solid;
  border-color: #dde4e9;
  border-width: 1px;
  background: #ffffff;
`
