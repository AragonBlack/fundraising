import React, { useContext } from 'react'
import { useAppState, useApi } from '@aragon/api-react'
import styled from 'styled-components'
import { Badge, Box, Button, Countdown, BREAKPOINTS } from '@aragon/ui'
import addMilliseconds from 'date-fns/addMilliseconds'
import { PresaleViewContext } from '../context'
import PresaleGoal from '../components/PresaleGoal'
import { Presale } from '../constants'

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    presale: { state, presalePeriod, vestingCliffPeriod, vestingCompletePeriod },
  } = useAppState()
  const presaleEnded = state !== Presale.state.PENDING && state !== Presale.state.FUNDING

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()

  // *****************************
  // context state
  // *****************************
  const { startDate } = useContext(PresaleViewContext)
  const noStartDate = state === Presale.state.PENDING && startDate === 0
  const endDate = addMilliseconds(startDate, presalePeriod)
  const vestingCliffDate = addMilliseconds(startDate, vestingCliffPeriod)
  const vestingCompleteDate = addMilliseconds(startDate, vestingCompletePeriod)

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

  /**
   * Calls the `presale.close` smart contarct function on button click
   * @returns {void}
   */
  const handleClosePresale = () => {
    api
      .closePresale()
      .toPromise()
      .catch(console.error)
  }

  return (
    <>
      <Container>
        <div className="left">
          <PresaleGoal />
          <Box heading="Fundraising Period">
            {noStartDate && (
              <Button mode="strong" label="Open the presale" onClick={handleOpenPresale}>
                Open the presale
              </Button>
            )}
            {state === Presale.state.CLOSED && (
              <Button mode="strong" label="Open the presale" onClick={handleClosePresale}>
                Open the trading
              </Button>
            )}
            {presaleEnded && <p css="color: #212B36; font-size: 16px; margin-bottom: 0.5rem;">Presale closed</p>}
            {state === Presale.state.FUNDING && <p css="color: #637381; font-size: 16px; margin-bottom: 0.5rem;">Time remaining</p>}
            {(!noStartDate || presaleEnded) && <Countdown end={endDate} />}
          </Box>
        </div>
        <div className="right">
          <Box heading="Fundraising Timeline" padding={false}>
            <div className="timeline">
              <div>
                <p className="title">Presale</p>
                <div className="dot" />
                <div className="line" />
                {startDate !== 0 && <DateBadge>{startDate}</DateBadge>}
                <p className="text">Patreons can buy presale tokens</p>
              </div>
              <div>
                <p className="title">FUNDRAISING PERIOD ENDS</p>
                <div className="dot" />
                {startDate !== 0 && <DateBadge>{endDate}</DateBadge>}
                <p className="text">Fundraising app is inicialized</p>
              </div>
              <div>
                <p className="title">OPEN TRADING</p>
                <div className="dot" />
                {startDate !== 0 && <DateBadge>{endDate}</DateBadge>}
                <p className="text">The fundraising trading is open</p>
              </div>
              <div>
                <p className="title">CLIFF PERIOD ENDS</p>
                <div className="dot" />
                {startDate !== 0 && <DateBadge>{vestingCliffDate}</DateBadge>}
                <p className="text">Patreons can start claiming their vested tokens</p>
              </div>
              <div>
                <p className="title">VESTING PERIOD ENDS</p>
                <div className="dot" />
                {startDate !== 0 && <DateBadge>{vestingCompleteDate}</DateBadge>}
                <p className="text">Patreons can start claiming their vested tokens</p>
              </div>
            </div>
          </Box>
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
    margin-right: 1rem;
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
      margin-bottom: 1rem;
    }
  }

  .timeline {
    display: flex;
    padding: 2rem;

    & > div {
      width: 20%;
    }

    .title {
      height: 8rem;
      color: #637381;
      font-weight: 600;
      text-transform: uppercase;
    }

    .dot::before {
      content: '';
      height: 26px;
      border-radius: 30px;
      background: rgba(0, 0, 0, 0) linear-gradient(44.28deg, rgb(0, 219, 226) 0%, rgb(1, 191, 227) 101.29%) repeat scroll 0% 0%;
      mix-blend-mode: normal;
      opacity: 0.18;
      position: absolute;
      width: 26px;
      bottom: 190px;
    }

    .dot::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0) linear-gradient(44.28deg, rgb(0, 219, 226) 0%, rgb(1, 191, 227) 101.29%) repeat scroll 0% 0%;
      bottom: 198px;
      margin-left: 7px;
    }

    .line {
      border: 1px solid rgba(96, 128, 156, 0.24);
      position: absolute;
      width: 596px;
      margin-left: 16px;
      bottom: 202px;
    }

    .text {
      margin-top: 1rem;
      font-size: 16px;
      width: 124px;
    }
  }

  @media only screen and (max-width: ${BREAKPOINTS.large}px) {
    flex-direction: column;

    .left {
      width: 100%;
      margin-right: 0;
      margin-bottom: 1rem;
    }

    .right {
      width: 100%;
    }

    .timeline {
      .line {
        width: 524px;
      }
    }
  }

  @media only screen and (max-width: ${BREAKPOINTS.medium}px) {
    .timeline {
      padding-top: 3rem;
      padding-left: 6rem;
      flex-direction: column;

      & > div {
        width: 100%;
      }

      & > div + div {
        margin-top: 4rem;
      }

      .title {
        height: auto;
        width: 100%;
        margin-bottom: 1rem;
      }

      .text {
        width: 100%;
        margin-top: 0.5rem;
      }

      .dot::before {
        content: '';
        height: 26px;
        border-radius: 30px;
        background: rgba(0, 0, 0, 0) linear-gradient(44.28deg, rgb(0, 219, 226) 0%, rgb(1, 191, 227) 101.29%) repeat scroll 0% 0%;
        mix-blend-mode: normal;
        opacity: 0.18;
        position: absolute;
        width: 26px;
        bottom: auto;
        margin-left: -3rem;
        margin-top: -2.75rem;
      }

      .dot::after {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0) linear-gradient(44.28deg, rgb(0, 219, 226) 0%, rgb(1, 191, 227) 101.29%) repeat scroll 0% 0%;
        margin-left: 7px;
        bottom: auto;
        margin-left: -41px;
        margin-top: -37px;
      }

      .line {
        border: 1px solid rgba(96, 128, 156, 0.24);
        position: absolute;
        height: 642px;
        width: 1px;
        margin-top: -26px;
        margin-left: -36px;
        bottom: auto;
      }
    }
  }
`

const DateBadge = ({ children }) => (
  <Badge foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
    {new Date(children).toLocaleDateString()}
  </Badge>
)
