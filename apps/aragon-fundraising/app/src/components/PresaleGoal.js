import React, { useContext } from 'react'
import { useAppState, useApi, useConnectedAccount } from '@aragon/api-react'
import { Box, Button, GU } from '@aragon/ui'
import CircleGraph from '../components/CircleGraph'
import { PresaleViewContext } from '../context'
import { Presale } from '../constants'
import { formatBigNumber } from '../utils/bn-utils'

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    presale: {
      contributionToken: { symbol, decimals },
      goal,
      totalRaised,
    },
  } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()
  const account = useConnectedAccount()

  // *****************************
  // context state
  // *****************************
  const { state, setRefundPanel } = useContext(PresaleViewContext)

  // *****************************
  // misc
  // *****************************
  const circleColor = {
    [Presale.state.PENDING]: '#ecedf1',
    [Presale.state.FUNDING]: '#21c1e7',
    [Presale.state.GOAL_REACHED]: '#2CC68F',
    [Presale.state.REFUNDING]: '#FF6969',
  }

  /**
   * Calls the `presale.close` smart contarct function on button click
   * @param {Object} event - the event to prevent
   * @returns {void}
   */
  const handleOpenTrading = event => {
    event.preventDefault()
    if (account) {
      api
        .closePresale()
        .toPromise()
        .catch(console.error)
    }
  }

  return (
    <Box heading="Presale Goal">
      <div className="circle">
        <CircleGraph value={totalRaised.div(goal).toNumber()} size={224} width={6} color={circleColor[state]} />
        <div>
          <p css="color: #212B36; display: inline;">{formatBigNumber(totalRaised, decimals)}</p> {symbol} of{' '}
          <p css="color: #212B36; display: inline;">{formatBigNumber(goal, decimals)}</p> {symbol}
        </div>
        {state === Presale.state.GOAL_REACHED && (
          <>
            <p>Presale goal completed!</p>
            <Button
              wide
              mode="strong"
              label="Open trading"
              css={`
                margin-top: ${2 * GU}px;
                width: 100%;
              `}
              onClick={handleOpenTrading}
            >
              Open trading
            </Button>
          </>
        )}
        {state === Presale.state.REFUNDING && (
          <>
            <p css="color: #212B36; font-weight: 300; font-size: 16px;">Unfortunately, the goal set for this presale has not been reached.</p>
            <Button
              wide
              mode="strong"
              label="Refund Presale Tokens"
              css={`
                margin-top: ${2 * GU}px;
                width: 100%;
              `}
              onClick={() => setRefundPanel(true)}
            >
              Refund presale shares
            </Button>
          </>
        )}
      </div>
    </Box>
  )
}
