import React from 'react'
import { DropDown } from '@aragon/ui'

const items = ['Price history', 'Price variation']

export default ({ activeChart, setActiveChart }) => {
  return <DropDown items={items} selected={activeChart} onChange={setActiveChart} />
}
