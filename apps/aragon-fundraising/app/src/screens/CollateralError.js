import React from 'react'
import styled from 'styled-components'
import NoData from '../components/NoData'

export default () => (
  <Wrapper css="display: flex;justify-content: center;align-items: center;">
    <NoData message="Something went wrong with collaterals." />
  </Wrapper>
)

const Wrapper = styled.div`
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
`
