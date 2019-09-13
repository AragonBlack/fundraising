import React, { useState } from 'react'
import styled from 'styled-components'
import { Badge, Box, Countdown, SafeLink, Button, BREAKPOINTS } from '@aragon/ui'
import CircleGraph from '../components/CircleGraph'
import RefundSidePanel from '../components/RefundSidePanel'

export default ({ state }) => {
  const [refundPanel, setRefundPanel] = useState(false)

  const DAY_IN_MS = 1000 * 60 * 60 * 24
  const endDate = new Date(Date.now() + 5 * DAY_IN_MS)
  const circleColor = { default: '#21c1e7', success: '#2CC68F', failure: '#FF6969' }

  return (
    <Container>
      <div className="left">
        <Box heading="Fundraising Goal">
          <div className="circle">
            <CircleGraph value={1 / 3} size={224} width={6} color={circleColor[state]} />
            {state !== 'success' && (
              <div>
                <p css="color: #212B36; display: inline;">10,766</p> DAI of <p css="color: #212B36; display: inline;">40,000</p> DAI
              </div>
            )}
            {state === 'success' && (
              <>
                <p>Target goal completed! 🎉</p>
                <Button wide mode="strong" label="Open Trading" css="margin-top: 1rem; width: 100%;" onClick={() => console.log('asdasd')}>
                  Open Trading
                </Button>
              </>
            )}
            {state === 'failure' && (
              <>
                <p css="color: #212B36; font-weight: 300; font-size: 16px;">Unfortunately, the target goal for this project has not been reached.</p>
                <Button wide mode="strong" label="Refund Presale Tokens" css="margin-top: 1rem; width: 100%;" onClick={() => setRefundPanel(true)}>
                  Refund Presale Tokens
                </Button>
              </>
            )}
          </div>
        </Box>
        <Box heading="Fundraising Period">
          {state === 'default' && <p css="color: #637381; font-size: 16px; margin-bottom: 0.5rem;">Time remaining</p>}
          {state !== 'default' && <p css="color: #212B36; font-size: 16px; margin-bottom: 0.5rem;">Presale closed</p>}
          <Countdown end={endDate} />
        </Box>
      </div>
      <div className="right">
        <Box heading="Description">
          Neufund provides an end-to-end solution for asset tokenization and issuance. Its open-source set of protocols for enhanced ownership allows anyone to
          give real-world assets a representation on the Ethereum Blockchain in form of legally-binding security tokens. The first application of our company’s
          tech and legal architecture are “Equity Tokens” which enable companies to conduct regulated offerings on Blockchain. You can read more about our
          progress on{' '}
          <SafeLink href="http://www.neufund.org" target="_blank">
            www.neufund.org
          </SafeLink>
          .
        </Box>
        <Box heading="Fundraising Timeline" padding={false}>
          <div className="timeline">
            <div>
              <p className="title">Presale</p>
              <div className="dot" />
              <div className="line" />
              <Badge foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
                22/08/2019
              </Badge>
              <p className="text">Patreons can buy presale tokens</p>
            </div>
            <div>
              <p className="title">FUNDRAISING PERIOD ENDS</p>
              <div className="dot" />
              <Badge foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
                01/09/2019
              </Badge>
              <p className="text">Fundraising app is inicialized</p>
            </div>
            <div>
              <p className="title">OPEN TRADING</p>
              <div className="dot" />
              <Badge foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
                01/09/2019
              </Badge>
              <p className="text">The fundraising trading is open</p>
            </div>
            <div>
              <p className="title">CLIFF PERIOD ENDS</p>
              <div className="dot" />
              <Badge foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
                01/09/2019
              </Badge>
              <p className="text">Patreons can start claiming their vested tokens</p>
            </div>
            <div>
              <p className="title">VESTING PERIOD ENDS</p>
              <div className="dot" />
              <Badge foreground="#4D22DF" background="rgba(204, 189, 244, 0.16)">
                01/09/2019
              </Badge>
              <p className="text">Patreons can start claiming their vested tokens</p>
            </div>
          </div>
        </Box>
      </div>
      <RefundSidePanel opened={refundPanel} onClose={() => setRefundPanel(false)} />
    </Container>
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
