import React, { useEffect, useContext, useRef, useState } from 'react'
import styled from 'styled-components'
import { useApi, useAppState } from '@aragon/api-react'
import { Button, DropDown, Text, TextInput, theme, unselectable } from '@aragon/ui'
import { MainViewContext } from '../../context'
import Total from './Total'
import Info from './Info'
import ValidationError from '../ValidationError'
import { round, toDecimals } from '../../lib/math-utils'

const Order = ({ isBuyOrder }) => {
  const {
    addresses: { marketMaker },
    collaterals,
    bondedToken: { decimals: bondedDecimals, symbol: bondedSymbol },
  } = useAppState()
  const collateralItems = [collaterals.dai, collaterals.ant]
  // get data from the react context
  const {
    order: { orderPanel, setOrderPanel },
  } = useContext(MainViewContext)

  const [selectedCollateral, setSelectedCollateral] = useState(1)
  const [amount, setAmount] = useState(undefined)
  const [valid, setValid] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const amountInput = useRef(null)

  const api = useApi()

  // handle reset when opening
  useEffect(() => {
    if (orderPanel) {
      // reset to default values
      setSelectedCollateral(0)
      setAmount(undefined)
      setValid(false)
      setErrorMessage(null)
      // focus the right input, given the order type
      // timeout to avoid some flicker
      amountInput && setTimeout(() => amountInput.current.focus(), 20)
    }
  }, [orderPanel, isBuyOrder])

  // // validate when new amounts
  useEffect(() => {
    validate()
  }, [amount])

  const handleAmountUpdate = event => {
    setAmount(event.target.value)
  }

  const validate = (err, message) => {
    setValid(err)
    setErrorMessage(message)
  }

  const roundAmount = amount => {
    return amount ? round(amount) : ''
  }

  const handleSubmit = event => {
    event.preventDefault()
    const address = collateralItems[selectedCollateral].address
    if (valid) {
      if (isBuyOrder) {
        const intent = { token: { address, value: amount, spender: marketMaker } }
        api
          .openBuyOrder(address, amount, intent)
          .toPromise()
          .catch(console.error)
      } else {
        api
          .openSellOrder(address, amount)
          .toPromise()
          .catch(console.error)
      }
      setOrderPanel(false)
    }
  }

  const getDecimals = () => {
    return isBuyOrder ? collateralItems[selectedCollateral].decimals : bondedDecimals
  }

  const getSymbol = () => {
    return isBuyOrder ? collateralItems[selectedCollateral].symbol : bondedSymbol
  }

  const getConversionSymbol = () => {
    return isBuyOrder ? bondedSymbol : collateralItems[selectedCollateral].symbol
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputsWrapper>
        <AmountField key="collateral">
          <label>
            {isBuyOrder && <StyledTextBlock>{collateralItems[selectedCollateral].symbol} TO SPEND</StyledTextBlock>}
            {!isBuyOrder && <StyledTextBlock>{bondedSymbol} TO SELL</StyledTextBlock>}
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
            <DropDown items={[collaterals.dai.symbol, collaterals.ant.symbol]} selected={selectedCollateral} onChange={setSelectedCollateral} />
          </CombinedInput>
        </AmountField>
      </InputsWrapper>
      <Total
        isBuyOrder={isBuyOrder}
        amount={{ value: amount, decimals: getDecimals(), symbol: getSymbol() }}
        conversionSymbol={getConversionSymbol()}
        onError={validate}
      />
      <ButtonWrapper>
        <Button mode="strong" type="submit" disabled={!valid} wide>
          Open {isBuyOrder ? 'buy' : 'sell'} order
        </Button>
      </ButtonWrapper>

      <Info isBuyOrder={isBuyOrder} slippage={collateralItems[selectedCollateral].slippage} />
      {errorMessage && <ValidationError message={errorMessage} />}
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
