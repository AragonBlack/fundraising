import React, { useRef, useState } from 'react'
import { Badge, Button, Text } from '@aragon/ui'
import styled from 'styled-components'
import HoverNotification from '../components/HoverNotification/HoverNotification'
import Box from '../components/Box/Box'
import TextInput from '../components/Input/TextInput'
import EditIcon from '../assets/EditIcon.svg'

// In this copy we should display the user the percentage of max increase of the tap
const hoverTextNotifications = [
  'This will update the monthly allocation (tap rate) i.e. how much funds can be released within the bonding curve contract per 30-day period. Note: this value must be less than the max increase limit set inside the contract.',
  "You're essentially bonding collateral when buying tokens (increasing the supply), and burning collateral when selling tokens (decreasing the supply). These relationships are defined by the smart contract.",
]

export default () => {
  const [state, setState] = useState({
    transferable: false,
    monthlyAllocation: 1000,
    totalSupply: 15000.456,
    antRatio: 60,
    daiRatio: 40,
  })

  const { transferable, monthlyAllocation, totalSupply, antRatio, daiRatio } = state
  const inputRef = useRef(monthlyAllocation)

  const handleMonthlyChange = event => {
    setState({ ...state, monthlyAllocation: event.target.value })
  }
  const onButtonClick = () => {
    const updatedAllocation = inputRef.current.value
    // call contract api to update if they have valid permissions
  }

  return (
    <ContentWrapper>
      <div className="settings">
        <h1 className="title bold">Edit reserve settings</h1>
        <div className="settings-content">
          <div css="margin-right: 4rem;">
            <div css="display: flex; flex-direction: column; margin-bottom: 1rem;">
              {NotificationLabel('Monthly allocation', hoverTextNotifications[0])}
              <StyledTextInput
                ref={inputRef}
                adornment={
                  <Text as="p" style={{ paddingRight: '12px' }}>
                    DAI
                  </Text>
                }
                adornmentPosition={'end'}
                value={monthlyAllocation}
                onChange={handleMonthlyChange}
                required
              />
            </div>
            <Button type="submit" css={buttonStyle} onSubmit={onButtonClick}>
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
            <div css="display: flex; flex-direction: column; margin-bottom: 1.5rem;">
              {NotificationLabel('ANT collateralization ratio', hoverTextNotifications[1])}
              <Text>{antRatio}%</Text>
            </div>
            <div css="display: flex; flex-direction: column;">
              {NotificationLabel('DAI collateralization ratio', hoverTextNotifications[1])}
              <Text>{daiRatio}%</Text>
            </div>
          </div>
        </div>
      </div>
      <Box heading="Monthly Allowance" css={monthlyAllowanceStyle}>
        <div className="item">
          <p>Total Supply</p>
          <p className="bold">{totalSupply}</p>
        </div>

        <div className="item">
          <p>Transferable</p>
          <p className="bold">{transferable ? 'YES' : 'NO'}</p>
        </div>

        <div className="item">
          <p>Token</p>
          <Badge css="height: 100%;">Ethical (ETH)</Badge>
        </div>
      </Box>
    </ContentWrapper>
  )
}

const NotificationLabel = (label, hoverText) => (
  <Text css="margin-bottom: 0.5rem;">
    {label}
    <HoverNotification copy={hoverText}>
      <Badge.Notification style={{ margin: '0 10px', cursor: 'pointer', background: '#7C80F2', boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.15)' }}>
        ?
      </Badge.Notification>
    </HoverNotification>
  </Text>
)

const StyledTextInput = styled(TextInput)`
  width: 100%;
`

const buttonStyle = `
  border: 1px solid rgba(223, 227, 232, 0.75);
  border-radius: 3px;
  box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.1);
  color: #26324E;
  padding: .5rem 1rem;
  display: flex;
  width: min-content;
`

const monthlyAllowanceStyle = `
  width: 25%;
  height: 100%;

  p {
    font-size: 16px;
    font-weight: 300;
    color: #637381;
  }

  .item {
    display: flex;
    justify-content: space-between;
  }

  .item + .item {
    margin-top: 1rem;
  }

  @media only screen and (max-width: 1152px) {
    width: 50%;
  }

  @media only screen and (max-width: 600px) {
    width: 100%;
  }
`

const ContentWrapper = styled.div`
  padding-top: 1rem;
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
    padding: 1rem;
  }

  @media only screen and (max-width: 600px) {
    flex-direction: column;

    .settings {
      width: 100%;
      margin-bottom: 1rem;
    }
  }
`
