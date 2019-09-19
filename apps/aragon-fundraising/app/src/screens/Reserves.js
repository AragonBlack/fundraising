import React, { useEffect, useState } from 'react'
import { Box, Button, Field, GU, Help, Info, SidePanel, Split, TextInput, textStyle, TokenBadge, useLayout, useTheme } from '@aragon/ui'
import { useApi, useAppState } from '@aragon/api-react'
import styled from 'styled-components'
import { differenceInMonths } from 'date-fns'
import EditIcon from '../assets/EditIcon.svg'
import HoverNotification from '../components/HoverNotification'
import ValidationError from '../components/ValidationError'
import DefinitionsBox from '../components/DefinitionsBox'
import { formatBigNumber, fromMonthlyAllocation, toMonthlyAllocation, toDecimals, fromDecimals } from '../utils/bn-utils'

// In this copy we should display the user the percentage of max increase of the tap
const helpContent = [
  [
    'What is the tap?',
    'The tap defines the amount of funds which can be released every month out of the market-maker reserve to the beneficiary of the fundraising campaign.',
  ],
  [
    'What is the reserve ratio?',
    'The reserve ratio defines the ratio between the amount of collateral in your market-maker reserve and the market cap of the fundraising campaign.',
  ],
  ['What is the floor?', 'The floor defines the amount of funds which must be kept in the market-maker reserve regardless of the tap rate.'],
]

function ReserveSetting({ label, helpContent: [hint, help], value }) {
  const theme = useTheme()
  return (
    <div
      css={`
        display: flex;
        flex-direction: column;
        margin-bottom: ${3 * GU}px;
      `}
    >
      <div
        css={`
          display: flex;
          align-items: center;
        `}
      >
        <span
          css={`
            margin-right: ${1 * GU}px;
            color: ${theme.surfaceContentSecondary};
          `}
        >
          {label}
        </span>
        <Help hint={hint}>{help}</Help>
      </div>
      <p
        css={`
          ${textStyle('body1')};
          font-weight: 600;
        `}
      >
        {value}
      </p>
    </div>
  )
}

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    constants: { PPM, PCT_BASE },
    values: { maximumTapIncreasePct },
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
    bondedToken: { name, symbol, decimals: tokenDecimals, realSupply },
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
  const adjustedIncrease = maximumTapIncreasePct.div(PCT_BASE)
  const displayIncrease = formatBigNumber(adjustedIncrease.times(100), 0, 0)
  const daiRatio = formatBigNumber(daiReserveRatio.div(PPM), 0)
  const antRatio = formatBigNumber(antReserveRatio.div(PPM), 0)

  // *****************************
  // internal state
  // *****************************
  const [newRate, setNewRate] = useState(fromDecimals(adjustedRate, daiDecimals).toFixed())
  const [newFloor, setNewFloor] = useState(fromDecimals(floor, daiDecimals).toFixed())
  const [errorMessage, setErrorMessage] = useState(null)
  const [valid, setValid] = useState(false)
  const [opened, setOpened] = useState(false)

  // *****************************
  // effects
  // *****************************
  // handle reset when opening
  useEffect(() => {
    if (opened) {
      // reset to default values and validate them
      setNewRate(fromDecimals(adjustedRate, daiDecimals).toFixed())
      setNewFloor(fromDecimals(floor, daiDecimals).toFixed())
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
    // check if it's a tap decrease
    const isDecrease = fromMonthlyAllocation(newRate, daiDecimals).lte(rate)
    // check if the tap increase respects the max tap increase
    const regularIncrease = fromMonthlyAllocation(newRate, daiDecimals).lte(rate.times(adjustedIncrease).plus(rate))
    // check if the last tap update is at least one month old
    // when a tap have never been updated, there's no timestamp, and can be updated
    const atLeastOneMonthOld = timestamp ? differenceInMonths(new Date(), new Date(timestamp)) >= 1 : true
    // updating tap is valid if:
    // - it's a decrease
    // - or it's a regular increase after at least one month since the previous increase (or never been updated)
    const valid = isDecrease || (regularIncrease && atLeastOneMonthOld)
    if (valid) {
      setErrorMessage(null)
      setValid(true)
    } else {
      setErrorMessage(
        !atLeastOneMonthOld ? 'You cannot increase the tap more than once per month.' : `You cannot increase the tap by more than ${displayIncrease}%}.`
      )
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
      console.log(daiAddress)
      console.log(rate)
      console.log(floor)
      api
        .updateTokenTap(daiAddress, rate, floor)
        .toPromise()
        .catch(console.error)
    }
  }

  const theme = useTheme()
  const { layoutName } = useLayout()

  const editMonthlyAllocationButton = <Button icon={<img src={EditIcon} />} label="Edit monthly allocation" onClick={() => setOpened(true)}></Button>

  return (
    <React.Fragment>
      <Split
        primary={
          <Box padding={layoutName === 'small' ? 2 * GU : 3 * GU}>
            <div
              css={`
                display: grid;
                grid-column-gap: ${3 * GU}px;
                grid-template-columns: repeat(${layoutName === 'small' ? '1' : '2'}, 1fr);
                width: 100%;
              `}
            >
              <div>
                <h1
                  css={`
                    margin-bottom: ${3 * GU}px;
                    ${textStyle('body1')};
                  `}
                >
                  Edit reserve settings
                </h1>
                <ReserveSetting label="Monthly allocation" helpContent={helpContent[0]} value={`${displayRate} DAI / month`} />
                <ReserveSetting label="Floor" helpContent={helpContent[2]} value={`${displayFloor} DAI`} />
                <div>{layoutName !== 'small' && editMonthlyAllocationButton}</div>
              </div>
              <div>
                {[[daiSymbol, daiRatio], [antSymbol, antRatio]].map(([symbol, ratio], i) => (
                  <ReserveSetting
                    key={i}
                    label={`${symbol} collateralization ratio`}
                    helpContent={helpContent[1]}
                    value={
                      <span>
                        {ratio}
                        <span
                          css={`
                            margin-left: ${0.5 * GU}px;
                            color: ${theme.surfaceContentSecondary};
                          `}
                        >
                          %
                        </span>
                      </span>
                    }
                  />
                ))}
              </div>
              {layoutName === 'small' && editMonthlyAllocationButton}
            </div>
          </Box>
        }
        secondary={
          <DefinitionsBox
            heading="Bonded Token"
            definitions={[
              { label: 'Total Supply', content: <strong>{adjustedTokenSupply}</strong> },
              {
                label: 'Token',
                content: <TokenBadge name={name} symbol={symbol} badgeOnly />,
              },
            ]}
          />
        }
      />
      <SidePanel opened={opened} onClose={() => setOpened(false)} title="Monthly allocation">
        <form
          onSubmit={handleSubmit}
          css={`
            margin-top: ${3 * GU}px;
          `}
        >
          <Field label="Tap (DAI)">
            <TextInput type="number" value={newRate} onChange={handleMonthlyChange} wide required />
          </Field>
          <Field label="Floor (DAI)">
            <TextInput type="number" value={newFloor} onChange={handleFloorChange} wide required />
          </Field>
          <Button mode="strong" type="submit" disabled={!valid} wide>
            Save monthly allocation
          </Button>
          {errorMessage && (
            <Info
              mode="error"
              css={`
                margin-top: ${2 * GU}px;
              `}
            >
              {errorMessage}
            </Info>
          )}
          <Info
            title="Info"
            css={`
              margin-top: ${2 * GU}px;
            `}
          >
            <p>You can increase the tap by {displayIncrease}%.</p>
            <p>Current monthly allocation: {displayRate} DAI.</p>
            <p>Current floor: {displayFloor} DAI.</p>
          </Info>
        </form>
      </SidePanel>
    </React.Fragment>
  )
}
