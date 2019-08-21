import React from 'react'
import { Text } from '@aragon/ui'

const Total = ({ isBuyOrder, collateral, token }) => {
  return (
    <div css="display: flex;">
      <div css="width: 50%">
        <Text weight="bold">TOTAL</Text>
      </div>
      <div css="width: 25%; display: flex; flex-direction: column; direction: rtl;">
        <Text weight="bold">{isBuyOrder ? collateral.value || 0 : token.value || 0}</Text>
        <Text color="grey">{isBuyOrder ? token.value || 0 : collateral.value || 0}~</Text>
      </div>
      <div css="width: 25%; display: flex; flex-direction: column; margin-left: 1rem;">
        <Text weight="bold">{isBuyOrder ? collateral.symbol : token.symbol}</Text>
        <Text color="grey">{isBuyOrder ? token.symbol : collateral.symbol}</Text>
      </div>
    </div>
  )
}

export default Total
