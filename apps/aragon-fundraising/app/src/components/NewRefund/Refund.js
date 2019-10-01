import React from 'react'
import styled from 'styled-components'
import { useApi, useAppState, useConnectedAccount } from '@aragon/api-react'
import { Button, Text } from '@aragon/ui'
import Info from './Info'
import { formatBigNumber } from '../../utils/bn-utils'

export default () => {
  // *****************************
  // background script state
  // *****************************
  const {
    presale: {
      contributionToken: { symbol, decimals },
    },
    contributions,
  } = useAppState()

  // *****************************
  // aragon api
  // *****************************
  const api = useApi()
  const account = useConnectedAccount()

  const handleRefund = vestedPurchaseId => {
    if (account) {
      api
        .refund(account, vestedPurchaseId)
        .toPromise()
        .catch(console.error)
    }
  }

  return (
    <div>
      {account &&
        contributions.get(account) &&
        contributions.get(account).map(c => {
          return (
            <div key={c.vestedPurchaseId}>
              <Text css="margin: 1rem 0;">
                Contribution of {formatBigNumber(c.value, decimals)} {symbol} the {new Date(c.timestamp).toLocaleDateString()}
              </Text>
              <Button mode="strong" wide onClick={() => handleRefund(c.vestedPurchaseId)}>
                Refund
              </Button>
            </div>
          )
        })}
      {(!account || !contributions.get(account)) && <p css="margin-top: 1rem;">You don't have any contributions</p>}
      <Info />
    </div>
  )
}
