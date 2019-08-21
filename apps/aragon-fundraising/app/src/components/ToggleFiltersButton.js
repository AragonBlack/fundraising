import React from 'react'
import { IconFilter } from '@aragon/ui'
import styled from 'styled-components'

export default props => (
  <Button label="Toggle filters" {...props}>
    <IconFilter color={props.active ? '#00CBE6' : '#8FA4B5'} />
    Filters
  </Button>
)

const Button = styled.div`
  display: flex;
  align-items: center;
  float: right;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(223, 227, 232, 0.75);
  border-radius: 4px;
  padding: 0.5rem 1rem;
  padding-left: 0.5rem;
  &:hover {
    cursor: pointer;
  }
`
