import React, { useState, useEffect } from 'react'
import { Text } from '@aragon/ui'
import { useApi, useAppState } from '@aragon/api-react'
import BN from 'bn.js'
import BancorFormulaAbi from '../../abi/BancorFormula.json'
import { round, fromDecimals, toDecimals } from '../../lib/math-utils'

const Total = ({ isBuyOrder, collateral, token }) => {
  const { common } = useAppState()
  const api = useApi()

  const [evaluatedPrice, setEvaluatedPrice] = useState(0)
  const formula = api.external(common.addresses.formula, BancorFormulaAbi)

  useEffect(() => {
    let didCancel = false

    const evaluateOrderReturn = async () => {
      if (isBuyOrder) {
        const result = await formula
          .calculatePurchaseReturn('100000000000000000000000', '10000000000000000000000', 100000, toDecimals(collateral.value.toString(), collateral.decimals))
          .toPromise()
          .catch(console.error)

        if (!didCancel) {
          setEvaluatedPrice(round(fromDecimals(result.toString(), token.decimals)))
        }
      } else {
        const result = await formula
          .calculateSaleReturn('100000000000000000000000', '10000000000000000000000', 100000, toDecimals(token.value.toString(), token.decimals))
          .toPromise()
          .catch(console.error)

        if (!didCancel) {
          setEvaluatedPrice(round(fromDecimals(result.toString(), collateral.decimals)))
        }
      }
    }

    evaluateOrderReturn()

    return () => {
      didCancel = true
    }
  }, [isBuyOrder, collateral, token])

  return (
    <div css="display: flex;">
      <div css="width: 50%">
        <Text weight="bold">TOTAL</Text>
      </div>
      <div css="width: 25%; display: flex; flex-direction: column; direction: rtl;">
        <Text weight="bold">{isBuyOrder ? collateral.value || 0 : token.value || 0}</Text>
        <Text color="grey">{evaluatedPrice}~</Text>
      </div>
      <div css="width: 25%; display: flex; flex-direction: column; margin-left: 1rem;">
        <Text weight="bold">{isBuyOrder ? collateral.symbol : token.symbol}</Text>
        <Text color="grey">{isBuyOrder ? token.symbol : collateral.symbol}</Text>
      </div>
    </div>
  )
}

export default Total
