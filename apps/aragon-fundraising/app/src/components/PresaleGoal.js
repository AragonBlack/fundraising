import React, { useContext } from 'react'
import { useAppState, useApi, useConnectedAccount } from '@aragon/api-react'
import { Box, Button, useTheme, GU } from '@aragon/ui'
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
  const theme = useTheme()
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
    [Presale.state.FUNDING]: theme.accent,
    [Presale.state.GOAL_REACHED]: theme.positive,
    [Presale.state.REFUNDING]: theme.negative,
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
        <CircleGraph value={totalRaised.div(goal).toNumber()} size={20.5 * GU} width={6} color={circleColor[state]} />
        <p
          title={`${formatBigNumber(totalRaised, decimals)} ${symbol} of ${formatBigNumber(goal, decimals)} ${symbol}`}
          css={`
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: ${theme.surfaceContentSecondary};
          `}
        >
          <span
            css={`
              color: ${theme.surfaceContent};
            `}
          >
            {formatBigNumber(totalRaised, decimals)}
          </span>{' '}
          {symbol} of{' '}
          <span
            css={`
              color: ${theme.surfaceContent};
            `}
          >
            {formatBigNumber(goal, decimals)}
          </span>{' '}
          {symbol}
        </p>
        {state === Presale.state.GOAL_REACHED && (
          <>
            <p
              css={`
                white-space: nowrap;
                margin-top: ${2 * GU}px;
                color: ${theme.surfaceContent};
              `}
            >
              <strong>Presale goal completed! 🎉</strong>
            </p>
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
            <p
              css={`
                margin-top: ${2 * GU}px;
              `}
            >
              Unfortunately, the goal set for this presale has not been reached.
            </p>
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
