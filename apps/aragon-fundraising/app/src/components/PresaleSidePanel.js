import React, { useContext } from 'react'
import styled from 'styled-components'
import { Button, SidePanel, Text, TextInput } from '@aragon/ui'
import transferArrows from '../assets/TransferArrows.svg'

export default ({ opened, onClose }) => {
  return (
    <SidePanel title="Buy Presale Tokens" opened={opened} onClose={onClose}>
      <div css="margin: 0 -30px 0;" />
      <p css="margin: 1rem 0;">Your balance: TODO DAI</p>
      <Form>
        <div className="fields">
          <div>
            <p
              css={`
                text-transform: uppercase;
                color: #637381;
                font-size: 14px;
                opacity: 0.7;
              `}
            >
              Order amount
            </p>
            <div
              css={`
                display: flex;
                align-items: center;
                > div {
                  width: 100%;
                }
              `}
            >
              <StyledTextInput
                adornment={<span css="padding-right: 14px;">DAI</span>}
                adornmentPosition="end"
                type="number"
                css="padding-right: 3rem;"
                onChange={() => {}}
                wide
                required
              />
            </div>
          </div>

          <img src={transferArrows} className="arrows" />

          <div
            css={`
              display: flex;
              align-items: center;
              white-space: nowrap;
            `}
          >
            <div
              css={`
                > div {
                  width: 100%;
                }
              `}
            >
              <p
                css={`
                  text-transform: uppercase;
                  color: #637381;
                  font-size: 14px;
                  opacity: 0.7;
                `}
              >
                Token amount
              </p>
              <StyledTextInput
                type="number"
                adornment={<span style={{ paddingRight: '14px' }}>ATL</span>}
                adornmentPosition="end"
                css="padding-right: 3rem;"
                onChange={() => {}}
                required
                wide
              />
            </div>
          </div>
        </div>
        <Button mode="strong" type="submit" css="width: 100%;">
          Place buy order
        </Button>
        <div
          css={`
            background-color: #f1fbff;
            border-radius: 4px;
            color: #188aaf;
            padding: 1rem;
            margin-top: 2rem;
            border-left: 2px solid #0ab0e5;
          `}
        >
          <p css="font-weight: 700;">Info</p>
          <p>Some info here</p>
        </div>
      </Form>
    </SidePanel>
  )
}

const StyledTextInput = styled(TextInput)`
  border: 1px solid #dde4e9;
  box-shadow: none;
  width: 100%;
`

const Form = styled.div`
  display: block;

  .fields {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .arrows {
    height: 16px;
    margin: 0 0.5rem;
    margin-top: 1rem;
  }

  @media only screen and (max-width: 424px) {
    .fields {
      flex-direction: column;
    }

    .arrows {
      margin-bottom: 0.75rem;
    }
  }
`
