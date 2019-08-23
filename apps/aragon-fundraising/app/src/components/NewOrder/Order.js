import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Button, DropDown, Text, TextInput, theme, unselectable } from '@aragon/ui'
import Total from './Total'
import Info from './Info'
import ValidationError from '../ValidationError'
import { round, toDecimals } from '../../lib/math-utils'

const Order = ({ opened, isBuyOrder, collaterals, bondedToken, polledData, onOrder }) => {
  const [selectedCollateral, setSelectedCollateral] = useState(0)
  const [amount, setAmount] = useState(undefined)
  const [valid, setValid] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const amountInput = useRef(null)

  const collateralSymbols = collaterals.map(c => c.symbol)

  // handle reset when opening
  useEffect(() => {
    if (opened) {
      // reset to default values
      setSelectedCollateral(0)
      setAmount(undefined)
      setValid(false)
      setErrorMessage(null)
      // focus the right input, given the order type
      // timeout to avoid some flicker
      amountInput && setTimeout(() => amountInput.current.focus(), 20)
    }
  }, [opened, isBuyOrder])

  // // validate when new amounts
  // useEffect(() => {
  //   validate()
  // }, [amount])

  const handleAmountUpdate = event => {
    setAmount(event.target.value)
  }

  const validate = (err, message) => {
    // TODO: is this good, when token price is very high/low ?
    // TODO: check balance ?
    // TODO: error message ?
    setValid(err)
    setErrorMessage(message)
  }

  const roundAmount = amount => {
    return amount ? round(amount) : ''
  }

  const handleSubmit = event => {
    event.preventDefault()

    const collateral = collaterals[selectedCollateral]
    const decimals = isBuyOrder ? collateral.decimals : bondedToken.decimals
    console.log(decimals)

    console.log(collaterals[selectedCollateral])
    console.log(bondedToken)
    console.log('old amount: ' + amount)
    console.log('new amount:' + toDecimals(amount, decimals))

    if (valid) onOrder(collateral.address, toDecimals(amount, decimals), isBuyOrder)
  }

  const getDecimals = () => {
    return isBuyOrder ? collaterals[selectedCollateral].decimals : bondedToken.decimals
  }

  const getSymbol = () => {
    return isBuyOrder ? collateralSymbols[selectedCollateral] : bondedToken.symbol
  }

  const getConversionSymbol = () => {
    return isBuyOrder ? bondedToken.symbol : collateralSymbols[selectedCollateral]
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputsWrapper>
        <AmountField key="collateral">
          <label>
            {isBuyOrder && <StyledTextBlock>{collaterals[selectedCollateral].symbol} TO SPEND</StyledTextBlock>}
            {!isBuyOrder && <StyledTextBlock>{bondedToken.symbol} TO SELL</StyledTextBlock>}
          </label>
          <CombinedInput>
            <TextInput
              ref={amountInput}
              type="number"
              value={roundAmount(amount)}
              onChange={handleAmountUpdate}
              min={0}
              placeholder="0"
              step="any"
              required
              wide
            />
            {!isBuyOrder && (
              <Text
                as="span"
                css={`
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  margin: 0 10px;
                `}
              >
                against
              </Text>
            )}
            <DropDown items={collateralSymbols} selected={selectedCollateral} onChange={setSelectedCollateral} />
          </CombinedInput>
        </AmountField>
      </InputsWrapper>
      <Total
        isBuyOrder={isBuyOrder}
        amount={{ value: amount, decimals: getDecimals(), symbol: getSymbol() }}
        conversionSymbol={getConversionSymbol()}
        polledData={polledData}
        bondedToken={bondedToken}
        onError={validate}
      />
      <ButtonWrapper>
        <Button mode="strong" type="submit" disabled={!valid} wide>
          Open {isBuyOrder ? 'buy' : 'sell'} order
        </Button>
      </ButtonWrapper>
      {errorMessage && <ValidationError message={errorMessage} />}
      <Info isBuyOrder={isBuyOrder} />
    </form>
  )
}

const ButtonWrapper = styled.div`
  padding-top: 10px;
`

const AmountField = styled.div`
  margin-bottom: 20px;
`

const InputsWrapper = styled.div`
  display: flex;
  flex-direction: column;
`

const CombinedInput = styled.div`
  display: flex;
  input[type='text'] {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right: 0;
  }
  input[type='text'] + div > div:first-child {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`

const StyledTextBlock = styled(Text.Block).attrs({
  color: theme.textSecondary,
  smallcaps: true,
})`
  ${unselectable()};
  display: flex;
`

export default Order
