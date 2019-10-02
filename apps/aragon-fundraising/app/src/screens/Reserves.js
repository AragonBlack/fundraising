import React, { useEffect, useState } from 'react'
import { Tag, Box, Button, DiscButton, Text, TextInput, theme, SidePanel, unselectable, Info, IdentityBadge } from '@aragon/ui'
import { useApi, useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import { differenceInMonths } from 'date-fns'
import EditIcon from '../assets/EditIcon.svg'
import HoverNotification from '../components/HoverNotification'
import ValidationError from '../components/ValidationError'
import { formatBigNumber, fromMonthlyAllocation, toMonthlyAllocation, toDecimals, fromDecimals } from '../utils/bn-utils'

// In this copy we should display the user the percentage of max increase of the tap
const hoverTextNotifications = [
  'The tap defines the amount of funds which can be released every month out of the market-maker reserve to the beneficiary of the fundraising campaign.',
  'The reserve ratio defines the ratio between the amount of collateral in your market-maker reserve and the market cap of the fundraising campaign.',
  'The floor defines the amount of funds which must be kept in the market-maker reserve regardless of the tap rate.',
]

const buttonStyle = `
  border: 1px solid rgba(223, 227, 232, 0.75);
  border-radius: 3px;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  color: #26324E;
  padding: .5rem 1rem;
  display: flex;
  width: min-content;
`

const bondedTokenStyle = `
  width: 25%;
  height: 100%;

  p {
    font-size: 16px;
    font-weight: 300;
    color: #637381;
  }

  .item {
    &:not(:first-child) {
      margin-top: 1rem;
    }
    display: flex;
    justify-content: space-between;
  }

  @media only screen and (max-width: 1152px) {
    width: 50%;
  }

  @media only screen and (max-width: 768px) {
    width: 100%;
  }
`

const ContentWrapper = styled.div`
  display: flex;

  .bold {
    font-size: 16px;
    font-weight: 600;
    color: #26324e;
  }

  .title {
    margin-bottom: 1rem;
  }

  .settings {
    border: 1px solid #dde4e9;
    border-radius: 4px;
    background: #ffffff;
    margin-right: 1rem;
    padding: 2rem;
    width: 75%;
  }

  .settings-content {
    display: flex;

    > div {
      display: flex;
      flex-direction: column;
      width: 50%;
    }
  }

  @media only screen and (max-width: 1152px) {
    .settings {
      width: 50%;
    }
    .settings-content {
      flex-direction: column;
      > div {
        width: 100%;
      }
      > div:first-child {
        margin-bottom: 2rem;
      }
    }
  }

  @media only screen and (max-width: 768px) {
    flex-direction: column;

    .settings {
      width: 100%;
      margin-bottom: 1rem;
    }
  }
`

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    constants: { PPM, PCT_BASE },
    values: { maximumTapRateIncreasePct, maximumTapFloorDecreasePct },
    collaterals: {
      dai: {
        address: daiAddress,
        reserveRatio: daiReserveRatio,
        symbol: daiSymbol,
        decimals: daiDecimals,
        tap: { rate, floor, timestamp },
      },
      ant: { reserveRatio: antReserveRatio, symbol: antSymbol },
    },
    bondedToken: { name, symbol, decimals: tokenDecimals, address, realSupply },
  } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()

  // *****************************
  // human readable values
  // *****************************
  const adjustedTokenSupply = formatBigNumber(realSupply, tokenDecimals)
  const adjustedRate = toMonthlyAllocation(rate, daiDecimals)
  const displayRate = formatBigNumber(adjustedRate, daiDecimals)
  const displayFloor = formatBigNumber(floor, daiDecimals)
  const adjustedRateIncrease = maximumTapRateIncreasePct.div(PCT_BASE)
  const adjustedFloorDecrease = maximumTapFloorDecreasePct.div(PCT_BASE)
  const displayRateIncrease = formatBigNumber(adjustedRateIncrease.times(100), 0, 0)
  const displayFloorIncrease = formatBigNumber(adjustedFloorDecrease.times(100), 0, 0)
  const daiRatio = formatBigNumber(daiReserveRatio.div(PPM).times(100), 0)
  const antRatio = formatBigNumber(antReserveRatio.div(PPM).times(100), 0)

  // *****************************
  // internal state
  // *****************************
  const [newRate, setNewRate] = useState(fromDecimals(adjustedRate, daiDecimals).toFixed(2, 1))
  const [newFloor, setNewFloor] = useState(fromDecimals(floor, daiDecimals).toFixed(2, 1))
  const [errorMessages, setErrorMessages] = useState(null)
  const [valid, setValid] = useState(false)
  const [opened, setOpened] = useState(false)

  // *****************************
  // effects
  // *****************************
  // handle reset when opening
  useEffect(() => {
    if (opened) {
      // reset to default values and validate them
      setNewRate(fromDecimals(adjustedRate, daiDecimals).toFixed(2, 1))
      setNewFloor(fromDecimals(floor, daiDecimals).toFixed(2, 1))
      validate()
    }
  }, [opened])

  // validate when new rate or new floor
  useEffect(() => {
    validate()
  }, [newRate, newFloor])

  // *****************************
  // handlers
  // *****************************
  const handleMonthlyChange = event => {
    setNewRate(event.target.value)
  }

  const handleFloorChange = event => {
    setNewFloor(event.target.value)
  }

  const validate = () => {
    // check if the last rate/floor update is at least one month old
    const atLeastOneMonthOld = timestamp ? differenceInMonths(new Date(), new Date(timestamp)) >= 1 : true

    // RATE RULES
    // check if it's a rate decrease
    const isRateDecrease = fromMonthlyAllocation(newRate, daiDecimals).lte(rate)
    // check if the rate increase respects the max rate increase
    const regularRateIncrease = fromMonthlyAllocation(newRate, daiDecimals).lte(rate.plus(rate.times(adjustedRateIncrease)))
    // updating rate is valid if:
    // - it's a decrease
    // - or it's a regular increase after at least one month since the previous update
    const validRate = isRateDecrease || (regularRateIncrease && atLeastOneMonthOld)

    // FLOOR RULES
    // check if it's a floor increase
    const isFloorIncrease = toDecimals(newFloor, daiDecimals).gte(floor)
    // check if the floor decrease respects the max floor decrease
    const regularFloorDecrease = toDecimals(newFloor, daiDecimals).gte(floor.minus(floor.times(adjustedFloorDecrease)))
    // updating floor is valid if:
    // - it's an increase
    // - or it's a regular decrease after at least one month since the previous update
    const validFloor = isFloorIncrease || (regularFloorDecrease && atLeastOneMonthOld)

    // stack messages for each validation problem
    const errorMessages = []
    if (validRate && validFloor) {
      setErrorMessages(null)
      setValid(true)
    } else if (!atLeastOneMonthOld) {
      if (!validRate) errorMessages.push(`You cannot increase the tap rate more than once per month`)
      if (!validFloor) errorMessages.push(`You cannot decrease the tap floor more than once per month`)
      setErrorMessages(errorMessages)
      setValid(false)
    } else {
      if (!validRate) errorMessages.push(`You cannot increase the tap rate by more than ${displayRateIncrease}%`)
      if (!validFloor) errorMessages.push(`You cannot decrease the tap floor by more than ${displayFloorIncrease}%`)
      setErrorMessages(errorMessages)
      setValid(false)
    }
  }

  const handleSubmit = event => {
    event.preventDefault()
    if (valid) {
      setOpened(false)
      // toFixed(0) returns rounded integers
      const rate = fromMonthlyAllocation(newRate, daiDecimals).toFixed(0)
      const floor = toDecimals(newFloor, daiDecimals).toFixed(0)
      api
        .updateTokenTap(daiAddress, rate, floor)
        .toPromise()
        .catch(console.error)
    }
  }

  return (
    <ContentWrapper>
      <div className="settings">
        <div className="settings-content">
          <div css="margin-right: 4rem;">
            <div css="display: flex; flex-direction: column; margin-bottom: 1.5rem;">
              {NotificationLabel('Rate', hoverTextNotifications[0])}
              <Text as="p" css="padding-right: 1.5rem; font-weight: bold;">
                {displayRate} DAI / month
              </Text>
            </div>
            <div css="display: flex; flex-direction: column; margin-bottom: 1.5rem;">
              {NotificationLabel('Floor', hoverTextNotifications[2])}
              <Text as="p" css="padding-right: 1.5rem; font-weight: bold;">
                {displayFloor} DAI
              </Text>
            </div>
            <Button css={buttonStyle} onClick={() => setOpened(true)}>
              <img src={EditIcon} />
              <p
                css={`
                  margin-top: 4px;
                  margin-left: 0.5rem;
                `}
              >
                Edit monthly allocation
              </p>
            </Button>
          </div>
          <div>
            {[{ symbol: daiSymbol, ratio: daiRatio }, { symbol: antSymbol, ratio: antRatio }].map(({ symbol, ratio }, i) => {
              return (
                <div css="display: flex; flex-direction: column; margin-bottom: 1.5rem;" key={i}>
                  {NotificationLabel(`${symbol} collateralization ratio`, hoverTextNotifications[1])}
                  <Text css="font-weight: bold;">{ratio}%</Text>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <Box heading="Shares" css={bondedTokenStyle}>
        <div className="item">
          <p>Total Supply</p>
          <p className="bold">{adjustedTokenSupply}</p>
        </div>

        <div className="item">
          <p>Token</p>
          <Tag css="height: 100%;" foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
            {`${name} (${symbol})`}
          </Tag>
        </div>
        <div className="item">
          <p>Address</p>
          <IdentityBadge entity={address} />
        </div>
      </Box>
      <SidePanel opened={opened} onClose={() => setOpened(false)} title="Monthly allocation">
        <div css="margin: 0 -30px 24px;" />
        <form onSubmit={handleSubmit}>
          <Wrapper>
            <label>
              <StyledTextBlock>Rate (DAI)</StyledTextBlock>
            </label>
            <TextInput type="number" value={newRate} onChange={handleMonthlyChange} wide required />
          </Wrapper>
          <Wrapper>
            <label>
              <StyledTextBlock>Floor (DAI)</StyledTextBlock>
            </label>
            <TextInput type="number" value={newFloor} onChange={handleFloorChange} wide required />
          </Wrapper>
          <ButtonWrapper>
            <Button mode="strong" type="submit" disabled={!valid} wide>
              Save monthly allocation
            </Button>
          </ButtonWrapper>
          {errorMessages && (
            <ValidationError
              message={errorMessages.map((e, i) => (
                <Text key={i} as="p">
                  {e}
                </Text>
              ))}
            />
          )}
          <Info css="margin-top: 1rem;">
            <p css="font-weight: 700;">Info</p>
            <Text as="p">You can increase the rate by {displayRateIncrease}%.</Text>
            <Text as="p">You can decrease the floor by {displayFloorIncrease}%.</Text>
            <Text as="p">Current monthly allocation: {displayRate} DAI</Text>
            <Text as="p">Current floor: {displayFloor} DAI</Text>
          </Info>
        </form>
      </SidePanel>
    </ContentWrapper>
  )
}

const ButtonWrapper = styled.div`
  padding-top: 10px;
`

const Wrapper = styled.div`
  margin-bottom: 20px;
`

const StyledTextBlock = styled(Text.Block).attrs({
  color: theme.textSecondary,
  smallcaps: true,
})`
  ${unselectable()};
  display: flex;
`

const NotificationLabel = (label, hoverText) => (
  <Text css="margin-bottom: 0.5rem;">
    {label}
    <HoverNotification copy={hoverText}>
      <DiscButton size={24} description="Help" css="margin-left: 1rem;">
        <span
          css={`
            font-size: 12px;
          `}
        >
          ?
        </span>
      </DiscButton>
    </HoverNotification>
  </Text>
)
