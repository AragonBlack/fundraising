import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { Button, DropDown, Text, TextInput, theme, unselectable } from '@aragon/ui'
import Total from './Total'
import Info from './Info'
import { round, toDecimals } from '../../lib/math-utils'

const Order = ({ opened, isBuyOrder, collaterals, bondedToken, price, onOrder }) => {
  const [selectedCollateral, setSelectedCollateral] = useState(0)
  const [collateralAmount, setCollateralAmount] = useState(0)
  const [tokenAmount, setTokenAmount] = useState(0)
  const [valid, setValid] = useState(false)

  const collateralAmountInput = useRef(null)
  const tokenAmountInput = useRef(null)

  const collateralSymbols = collaterals.map(c => c.symbol)

  // handle reset when opening
  useEffect(() => {
    if (opened) {
      // reset to default values
      setSelectedCollateral(0)
      setCollateralAmount(0)
      setTokenAmount(0)
      // focus the right input, given the order type
      // timeout to avoid some flicker
      let focusedInput = isBuyOrder ? collateralAmountInput : tokenAmountInput
      focusedInput && setTimeout(() => focusedInput.current.focus(), 0)
    }
  }, [opened, isBuyOrder])

  // validate when new amounts
  useEffect(() => {
    validate()
  }, [collateralAmount, tokenAmount])

  const handleCollateralAmountUpdate = event => {
    setCollateralAmount(event.target.value)
    setTokenAmount(event.target.value / price)
  }

  const handleTokenAmountUpdate = event => {
    setTokenAmount(event.target.value)
    setCollateralAmount(event.target.value * price)
  }

  const validate = () => {
    // TODO: is this good, when token price is very high/low ?
    // TODO: check balance ?
    // TODO: error message ?
    setValid(collateralAmount > 0 || tokenAmount > 0)
  }

  const roundAmount = amount => {
    return amount ? round(amount) : ''
  }

  const handleSubmit = event => {
    event.preventDefault()

    const collateral = collaterals[selectedCollateral]
    const decimals = isBuyOrder ? collateral.decimals : bondedToken.decimals
    const amount = isBuyOrder ? collateralAmount : tokenAmount
    // console.log(decimals)

    // console.log(collaterals[selectedCollateral])
    // console.log(bondedToken)
    // console.log('old amount: ' + amount)
    // console.log('new amount:' + toDecimals(amount, decimals))

    if (valid) onOrder(collateral.address, toDecimals(amount, decimals), isBuyOrder)
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputsWrapper>
        {isBuyOrder && (
          <AmountField key="collateral">
            <label>
              <StyledTextBlock>{collaterals[selectedCollateral].symbol} TO SPEND</StyledTextBlock>
            </label>
            <CombinedInput>
              <TextInput
                ref={collateralAmountInput}
                type="number"
                value={roundAmount(collateralAmount)}
                onChange={handleCollateralAmountUpdate}
                min={0}
                placeholder="0"
                step="any"
                required
                wide
              />
              <DropDown items={collateralSymbols} selected={selectedCollateral} onChange={setSelectedCollateral} />
            </CombinedInput>
          </AmountField>
        )}
        {!isBuyOrder && (
          <AmountField key="token">
            <label>
              <StyledTextBlock>{bondedToken.symbol} TO SELL</StyledTextBlock>
            </label>
            <CombinedInput>
              <TextInput
                ref={tokenAmountInput}
                type="number"
                value={roundAmount(tokenAmount)}
                onChange={handleTokenAmountUpdate}
                min={0}
                placeholder="0"
                step="any"
                required
                wide
              />
              <Text
                as="span"
                css={`
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  margin: 0 10px;
                `}
              >
                for
              </Text>
              <DropDown items={collateralSymbols} selected={selectedCollateral} onChange={setSelectedCollateral} />
            </CombinedInput>
          </AmountField>
        )}
      </InputsWrapper>
      <Total
        isBuyOrder={isBuyOrder}
        collateral={{ value: roundAmount(collateralAmount), decimals: collaterals[selectedCollateral].decimals, symbol: collateralSymbols[selectedCollateral] }}
        token={{ value: roundAmount(tokenAmount), decimals: bondedToken.decimals, symbol: bondedToken.symbol }}
      />
      <ButtonWrapper>
        <Button mode="strong" type="submit" disabled={!valid} wide>
          Open {isBuyOrder ? 'buy' : 'sell'} order
        </Button>
      </ButtonWrapper>
      <Info isBuyOrder={isBuyOrder} slippage={collaterals[selectedCollateral].slippage} />
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
