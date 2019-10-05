import React from 'react'
import { useApi, useAppState, useConnectedAccount, GU } from '@aragon/api-react'
import { Button, Info } from '@aragon/ui'
import Information from './Information'
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
        contributions?.get(account)?.length > 0 &&
        contributions.get(account).map(c => {
          return (
            <div
              key={c.vestedPurchaseId}
              css={`
                margin: ${4 * GU}px 0;
              `}
            >
              <Button mode="strong" wide onClick={() => handleRefund(c.vestedPurchaseId)}>
                Refund contribution of {formatBigNumber(c.value, decimals)} {symbol} made on {new Date(c.timestamp).toLocaleDateString()}
              </Button>
            </div>
          )
        })}
      {account && contributions?.get(account)?.length > 0 && <Information />}
      {(!account || !contributions?.get(account)?.length > 0) && (
        <Info
          css={`
            margin-top: ${2 * GU}px;
          `}
        >
          You don't have any contribution to refund.
        </Info>
      )}
    </div>
  )
}
