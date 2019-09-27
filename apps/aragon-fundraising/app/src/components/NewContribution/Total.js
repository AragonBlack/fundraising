import React, { useState, useEffect, useContext } from 'react'
import { Text } from '@aragon/ui'
import { useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import { PresaleViewContext } from '../../context'
import { formatBigNumber, toDecimals } from '../../utils/bn-utils'

export default ({ value, onError }) => {
  // *****************************
  // background script state
  // *****************************
  const {
    presale: {
      contributionToken: { symbol: contributionSymbol, decimals: contributionDecimals },
      token: { symbol, decimals },
      exchangeRate,
    },
  } = useAppState()

  // *****************************
  // context state
  // *****************************
  const { userDaiBalance } = useContext(PresaleViewContext)

  // *****************************
  // internal state
  // *****************************
  const [evaluatedPrice, setEvaluatedPrice] = useState(null)
  const [formattedValue, setFormattedValue] = useState(formatBigNumber(0, 0))

  // *****************************
  // effects
  // *****************************
  // recalculate price when amount changed
  useEffect(() => {
    const valueBn = toDecimals(value, contributionDecimals)
    if (userDaiBalance.lt(valueBn)) {
      // cannot buy more than your own balance
      setFormattedValue(formatBigNumber(value, 0))
      setEvaluatedPrice(null)
      onError(false, `Your ${contributionSymbol} balance is not sufficient`)
    } else if (value?.length && value > 0) {
      // only try to evaluate when an amount is entered, and valid
      setFormattedValue(formatBigNumber(valueBn, contributionDecimals))
      setEvaluatedPrice(formatBigNumber(exchangeRate.times(valueBn), decimals))
      onError(true, null)
    } else {
      // if input is empty, reset to default values and disable order button
      setFormattedValue(formatBigNumber(0, 0))
      setEvaluatedPrice(null)
      onError(false, null)
    }
  }, [value])

  return (
    <div css="display: flex; justify-content: space-between; padding: 0 5px;">
      <div>
        <Text weight="bold">TOTAL</Text>
      </div>
      <div css="display: flex; flex-direction: column">
        <div css="display: flex; justify-content: flex-end;">
          <AmountField weight="bold">{formattedValue}</AmountField>
          <Text weight="bold">{contributionSymbol}</Text>
        </div>
        <div css="display: flex; justify-content: flex-end;">
          {evaluatedPrice && <AmountField color="grey">~{evaluatedPrice}</AmountField>}
          {evaluatedPrice && <Text color="grey">{symbol}</Text>}
        </div>
      </div>
    </div>
  )
}

const AmountField = styled(Text)`
  margin-right: 10px;
`
