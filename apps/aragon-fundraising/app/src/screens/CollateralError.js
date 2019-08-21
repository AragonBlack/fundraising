import React from 'react'
import styled from 'styled-components'
import EmptyOrders from '../assets/EmptyOrders.svg'

export default () => (
  <Wrapper css="display: flex;justify-content: center;align-items: center;">
    <EmptyState>
      <img src={EmptyOrders} />
      <p css="font-size: 24px; margin-top: 1rem;">Something went wrong with collaterals.</p>
    </EmptyState>
  </Wrapper>
)

const Wrapper = styled.div`
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 500px;
  width: 500px;

  border-radius: 4px;
  border-style: solid;
  border-color: #dde4e9;
  border-width: 1px;
  background: #ffffff;
`
