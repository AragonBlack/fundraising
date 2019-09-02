import React, { useContext, useState, useEffect } from 'react'
import { Text } from '@aragon/ui'
import { useApi, useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import BigNumber from 'bignumber.js'
import { MainViewContext } from '../../context'
import BancorFormulaAbi from '../../abi/BancorFormula.json'
import { formatBigNumber, toDecimals } from '../../utils/bn-utils'

const Total = ({ isBuyOrder, amount, conversionSymbol, onError }) => {
  const {
    addresses: { formula: formulaAddress },
    bondedToken: { overallSupply },
  } = useAppState()

  const {
    polledData: { daiBalance, antBalance },
  } = useContext(MainViewContext)

  const api = useApi()
  const formula = api.external(formulaAddress, BancorFormulaAbi)

  const [evaluatedPrice, setEvaluatedPrice] = useState(0)

  const errorCb = () => {
    setEvaluatedPrice(null)
    onError(false, 'The amount is out of range of the supply')
  }

  const okCb = () => onError(true, null)

  useEffect(() => {
    let didCancel = false

    const evaluateOrderReturn = async () => {
      const functionToCall = isBuyOrder ? 'calculatePurchaseReturn' : 'calculateSaleReturn'
      const amountBn = toDecimals(new BigNumber(amount.value), amount.decimals)
      // supply, balance, weight, amount
      const currentSymbol = isBuyOrder ? amount.symbol : conversionSymbol
      const supply = currentSymbol === 'DAI' ? overallSupply.dai : overallSupply.ant
      const balance = amount.symbol === 'DAI' ? daiBalance : antBalance
      if (balance) {
        const result = await formula[functionToCall](supply.toFixed(), balance.toFixed(), 100000, amountBn.toFixed())
          .toPromise()
          .catch(errorCb)
        if (!didCancel && result) {
          okCb()
          const price = formatBigNumber(new BigNumber(result), amount.decimals)
          console.log(price)
          setEvaluatedPrice(price)
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
          {evaluatedPrice && <AmountField color="grey">~{evaluatedPrice}</AmountField>}
          {evaluatedPrice && <Text color="grey">{conversionSymbol}</Text>}
        </div>
      </div>
    </div>
  )
}

const AmountField = styled(Text)`
  margin-right: 10px;
`

export default Total
