import React, { useContext, useState, useEffect } from 'react'
import { Text } from '@aragon/ui'
import { useApi, useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import BigNumber from 'bignumber.js'
import { MainViewContext } from '../../context'
import BancorFormulaAbi from '../../abi/BancorFormula.json'
import { formatBigNumber, toDecimals } from '../../utils/bn-utils'

const Total = ({ isBuyOrder, amount, conversionSymbol, onError }) => {
  const { value, decimals, symbol, reserveRatio } = amount
  // *****************************
  // background script state
  // *****************************
  const {
    constants: { PCT_BASE },
    addresses: { formula: formulaAddress },
    bondedToken: { overallSupply },
    collaterals: {
      dai: { slippage: daiSlippage },
      ant: { slippage: antSlippage },
    },
  } = useAppState()
  const daiSlippageDec = daiSlippage.div(PCT_BASE)
  const antSlippageDec = antSlippage.div(PCT_BASE)

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()
  const formula = api.external(formulaAddress, BancorFormulaAbi)

  // *****************************
  // context state
  // *****************************
  const { price, daiBalance, antBalance, userDaiBalance, userAntBalance, userBondedTokenBalance } = useContext(MainViewContext)

  // *****************************
  // internal state
  // *****************************
  const [evaluatedPrice, setEvaluatedPrice] = useState(null)
  const [formattedAmount, setFormattedAmount] = useState(formatBigNumber(0, 0))

  // *****************************
  // handlers
  // *****************************
  const errorCb = (msg = null) => {
    setEvaluatedPrice(null)
    onError(false, msg)
  }

  const okCb = () => onError(true, null)

  // *****************************
  // effects
  // *****************************
  // recalculate price when amount, collateral or type of order changed
  useEffect(() => {
    let didCancel = false

    const evaluateOrderReturn = async () => {
      const functionToCall = isBuyOrder ? 'calculatePurchaseReturn' : 'calculateSaleReturn'
      const valueBn = toDecimals(value, decimals)
      // supply, balance, weight, amount
      const currentSymbol = isBuyOrder ? symbol : conversionSymbol
      const supply = currentSymbol === 'DAI' ? overallSupply.dai : overallSupply.ant
      const balance = currentSymbol === 'DAI' ? daiBalance : antBalance
      // slippage
      const currentSlippage = currentSymbol === 'DAI' ? daiSlippageDec : antSlippageDec
      // unit prices
      const maxPrice = new BigNumber(price).times(new BigNumber(1).plus(currentSlippage))
      const minPrice = new BigNumber(price).times(new BigNumber(1).minus(currentSlippage))

      if (balance) {
        const result = await formula[functionToCall](supply.toFixed(), balance.toFixed(), reserveRatio.toFixed(), valueBn.toFixed())
          .toPromise()
          .catch(() => errorCb('The amount is out of range of the supply'))
        if (!didCancel && result) {
          // check if the evaluated price don't break the slippage
          const resultBn = new BigNumber(result)
          const price = formatBigNumber(resultBn, decimals)
          setEvaluatedPrice(price)
          if (isBuyOrder && resultBn.lte(valueBn.div(maxPrice))) {
            errorCb('This buy order will break the price slippage')
          } else if (!isBuyOrder && resultBn.lte(valueBn.times(minPrice))) {
            errorCb('This sell order will break the price slippage')
          } else okCb()
        }
      } else {
        errorCb(null)
      }
    }

    const userBalance = symbol === 'DAI' ? userDaiBalance : userAntBalance
    if (isBuyOrder && userBalance.lt(toDecimals(value, decimals))) {
      // cannot buy more than your own balance
      setFormattedAmount(formatBigNumber(value, 0))
      setEvaluatedPrice(null)
      onError(false, `Your ${symbol} balance is not sufficient`)
    } else if (!isBuyOrder && userBondedTokenBalance.lt(toDecimals(value, decimals))) {
      // cannot sell more than your own balance
      setFormattedAmount(formatBigNumber(value, 0))
      setEvaluatedPrice(null)
      onError(false, `Your ${symbol} balance is not sufficient`)
    } else if (value?.length && value > 0) {
      // only try to evaluate when an amount is entered, and valid
      evaluateOrderReturn()
      setFormattedAmount(formatBigNumber(value, 0))
    } else {
      // if input is empty, reset to default values and disable order button
      setFormattedAmount(formatBigNumber(0, 0))
      errorCb(null)
    }

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
          <AmountField weight="bold">{formattedAmount}</AmountField>
          <Text weight="bold">{symbol}</Text>
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
