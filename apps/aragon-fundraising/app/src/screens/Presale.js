import React, { useContext, useState } from 'react'
import { useAppState, useApi, useConnectedAccount } from '@aragon/api-react'
import styled from 'styled-components'
import { Box, Button, Countdown, BREAKPOINTS, GU, Split, useLayout, DataView, Text, DropDown, shortenAddress, theme, unselectable } from '@aragon/ui'
import BigNumber from 'bignumber.js'
import addMilliseconds from 'date-fns/addMilliseconds'
import { PresaleViewContext } from '../context'
import PresaleGoal from '../components/PresaleGoal'
import Timeline from '../components/Timeline'
import LocalIdentityBadge from '../components/LocalIdentityBadge'
import { Presale } from '../constants'
import { formatBigNumber } from '../utils/bn-utils'

export default () => {
  // *****************************
  // background script, layout, connected account and dropdown states
  // *****************************
  const {
    presale: { period, vestingCliffPeriod, vestingCompletePeriod, contributionToken, token },
    contributions,
  } = useAppState()
  const { layoutName } = useLayout()
  const connectedAccount = useConnectedAccount()
  const [selected, setSelection] = useState(0)

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

  let contributionList = [...contributions.entries()]
    .map(item => {
      const reducedValues = item[1].reduce((prev, current) => {
        return {
          amount: new BigNumber(prev.amount).plus(new BigNumber(current.amount)),
          value: new BigNumber(prev.value).plus(new BigNumber(current.value)),
        }
      })

      item[1] = reducedValues

      return item
    })
    .sort((a, b) => b[1].value - a[1].value)

  contributionList = contributionList.map(item => ({
    account: item[0],
    contributions: formatBigNumber(item[1].value, contributionToken.decimals) + ' ' + contributionToken.symbol,
    shares: formatBigNumber(item[1].amount, token.decimals),
  }))

  const myContributions = contributionList.filter(item => {
    return item.account === connectedAccount
  })[0]

  const contributionAccounts = contributionList.map(item => item.account)
  contributionAccounts.unshift('All')

  if (selected !== 0) {
    contributionList = contributionList.filter(item => item.account === contributionAccounts[selected])
  }

  return (
    <>
      <Container>
        <Split
          invert={layoutName !== 'large' ? 'vertical' : 'horizontal'}
          secondary={
            <div>
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
              {myContributions && (
                <Box heading="My Contribution Info">
                  <div
                    css={`
                      display: flex;
                      justify-content: space-between;
                    `}
                  >
                    <p
                      css={`
                        color: #637381;
                        font-size: 16px;
                      `}
                    >
                      Contributions
                    </p>
                    <Text>{myContributions.contributions}</Text>
                  </div>
                  <div
                    css={`
                      display: flex;
                      justify-content: space-between;
                    `}
                  >
                    <p
                      css={`
                        color: #637381;
                        font-size: 16px;
                      `}
                    >
                      Shares
                    </p>
                    <Text>{myContributions.shares}</Text>
                  </div>
                </Box>
              )}
            </div>
          }
          primary={
            <div>
              <Timeline
                title="Fundraising Timeline"
                steps={[
                  ['Presale opens', openDate, 'Contributors can buy presale shares'],
                  ['Presale ends', openDate === 0 ? 0 : endDate, 'Trading can be opened'],
                  ['Cliff period ends', openDate === 0 ? 0 : vestingCliffDate, 'Your shares will start being unvested'],
                  ['Vesting period ends', openDate === 0 ? 0 : vestingCompleteDate, 'All your shares will be invested'],
                ]}
              />
              <DataView
                fields={['Account', 'Contributions', 'Shares']}
                entries={contributionList}
                renderEntry={({ account, contributions, shares }) => {
                  return [
                    <LocalIdentityBadge key="account" entity={account} />,
                    <Text key="contributions">{contributions}</Text>,
                    <Text key="shares">{shares}</Text>,
                  ]
                }}
                heading={
                  <div className="filter-item">
                    <span className="filter-label">Filter Account</span>
                    <DropDown
                      items={contributionAccounts}
                      selected={selected}
                      renderLabel={() => shortenAddress(contributionAccounts[selected])}
                      onChange={idx => setSelection(idx)}
                      css="min-width: auto;"
                    />
                  </div>
                }
              />
            </div>
          }
        />
      </Container>
    </>
  )
}

const Container = styled.div`
  display: flex;

  a {
    color: #3e7bf6;
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

  .filter-item {
    display: flex;
    align-items: center;
  }

  .filter-label {
    display: block;
    margin-right: 8px;
    font-variant: small-caps;
    text-transform: lowercase;
    color: ${theme.textSecondary};
    font-weight: 600;
    white-space: nowrap;
    ${unselectable};
  }

  @media only screen and (max-width: ${BREAKPOINTS.large}px) {
    flex-direction: column;
  }
`
