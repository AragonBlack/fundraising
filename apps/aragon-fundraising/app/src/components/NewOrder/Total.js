import React, { useState, useEffect } from 'react'
import { Text } from '@aragon/ui'
import { useApi, useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import BN from 'bn.js'
import BancorFormulaAbi from '../../abi/BancorFormula.json'
import { round, fromDecimals, toDecimals } from '../../lib/math-utils'

const Total = ({ isBuyOrder, amount, conversionSymbol, polledData, bondedToken, onError }) => {
  const { common } = useAppState()
  const api = useApi()
  const [evaluatedPrice, setEvaluatedPrice] = useState(0)

  const formula = api.external(common.addresses.formula, BancorFormulaAbi)

  const errorCb = () => {
    setEvaluatedPrice(null)
    onError(false, 'The amount is out of range of the supply')
  }

  const okCb = () => onError(true, null)

  useEffect(() => {
    let didCancel = false

    const evaluateOrderReturn = async () => {
      const functionToCall = isBuyOrder ? 'calculatePurchaseReturn' : 'calculateSaleReturn'
      const amountBn = new BN(amount.value)
      const a = toDecimals(amountBn.toString(), amount.decimals)
      // supply, balance, weight, amount
      const currentSymbol = isBuyOrder ? amount.symbol : conversionSymbol
      const supply = bondedToken.computedSupply.find(s => s.symbol === currentSymbol).value
      const balance = amount.symbol === 'DAI' ? polledData.polledDaiBalance : polledData.polledAntBalance
      console.log(balance)
      if (balance) {
        const result = await formula[functionToCall](supply.toString(), balance.toString(), 100000, a)
          .toPromise()
          .catch(errorCb)
        if (!didCancel && result) {
          okCb()
          const resultBn = new BN(result)
          setEvaluatedPrice(round(fromDecimals(resultBn.toString(), amount.decimals)))
        }
      } else {
        onError(false, null)
      }
    }

    evaluateOrderReturn()

    return () => {
      didCancel = true
    }
  }, [isBuyOrder, amount, conversionSymbol])

  return (
    <div css="display: flex; justify-content: space-between; padding: 0 5px;">
      <div>
        <Text weight="bold">TOTAL</Text>
      </div>
      <div css="display: flex; flex-direction: column">
        <div css="display: flex; justify-content: flex-end;">
          <AmountField weight="bold">{amount.value}</AmountField>
          <Text weight="bold">{amount.symbol}</Text>
        </div>
        <div css="display: flex; justify-content: flex-end;">
          {evaluatedPrice !== null && <AmountField color="grey">~{evaluatedPrice}</AmountField>}
          {evaluatedPrice !== null && <Text color="grey">{conversionSymbol}</Text>}
        </div>
      </div>
    </div>
  )
}

const AmountField = styled(Text)`
  margin-right: 10px;
`

export default Total
