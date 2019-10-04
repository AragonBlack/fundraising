import React, { useContext } from 'react'
import { useAppState, useApi } from '@aragon/api-react'
import styled from 'styled-components'
import { Box, Button, Countdown, BREAKPOINTS, GU } from '@aragon/ui'
import addMilliseconds from 'date-fns/addMilliseconds'
import { PresaleViewContext } from '../context'
import PresaleGoal from '../components/PresaleGoal'
import Timeline from '../components/Timeline'
import { Presale } from '../constants'

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    presale: { period, vestingCliffPeriod, vestingCompletePeriod },
  } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()

  // *****************************
  // context state
  // *****************************
  const { openDate, state } = useContext(PresaleViewContext)
  const presaleEnded = state !== Presale.state.PENDING && state !== Presale.state.FUNDING
  const noOpenDate = state === Presale.state.PENDING && openDate === 0
  const endDate = addMilliseconds(openDate, period)
  const vestingCliffDate = addMilliseconds(openDate, vestingCliffPeriod)
  const vestingCompleteDate = addMilliseconds(openDate, vestingCompletePeriod)

  /**
   * Calls the `presale.open` smart contarct function on button click
   * @returns {void}
   */
  const handleOpenPresale = () => {
    api
      .openPresale()
      .toPromise()
      .catch(console.error)
  }

  return (
    <>
      <Container>
        <div className="left">
          <PresaleGoal />
          <Box heading="Fundraising Period">
            {noOpenDate && (
              <Button wide mode="strong" label="Open presale" onClick={handleOpenPresale}>
                Open presale
              </Button>
            )}
            {presaleEnded && (
              <p
                css={`
                  color: #212b36;
                  font-size: 16px;
                `}
              >
                Presale closed
              </p>
            )}
            {state === Presale.state.FUNDING && (
              <p
                css={`
                  color: #637381;
                  font-size: 16px;
                `}
              >
                Time remaining
              </p>
            )}
            {!noOpenDate && !presaleEnded && (
              <Countdown
                css={`
                  margin-top: ${1 * GU}px;
                `}
                end={endDate}
              />
            )}
          </Box>
        </div>
        <div className="right">
          <Timeline
            title="Fundraising Timeline"
            steps={[
              ['Presale opens', openDate, 'Contributors can buy presale shares'],
              ['Presale ends', openDate === 0 ? 0 : endDate, 'Trading can be open'],
              ['Cliff period ends', openDate === 0 ? 0 : vestingCliffDate, 'Presale contributors can start claiming part of their vested shares'],
              ['Vesting period ends', openDate === 0 ? 0 : vestingCompleteDate, 'Presale contributors can claim all their vested shares'],
            ]}
          />
        </div>
      </Container>
    </>
  )
}

const Container = styled.div`
  display: flex;

  a {
    color: #3e7bf6;
  }

  .left {
    width: 25%;
    margin-right: ${2 * GU}px;
  }

  .right {
    width: 75%;
    font-size: 16px;
  }

  .circle {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    color: #637381;

    .progress-text {
      display: inherit;
    }

    & > div {
      margin-bottom: ${2 * GU}px;
    }
  }

  @media only screen and (max-width: ${BREAKPOINTS.large}px) {
    flex-direction: column;

    .left {
      width: 100%;
      margin-right: 0;
      margin-bottom: ${1 * GU}px;
    }

    .right {
      width: 100%;
    }
  }
`
