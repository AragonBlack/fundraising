import React from 'react'
import { Button, SidePanel, Text, TextInput, Info, theme } from '@aragon/ui'

export default ({ opened, onClose }) => {
  return (
    <SidePanel opened={opened} onClose={onClose} title="Monthly allocation">
      <div css="margin: 0 -30px 24px;" />
      <form onSubmit={() => console.log('asdasd')}>
        <div css="margin-bottom: 20px">
          <label>
            <Text.Block color={theme.textSecondary} smallcaps>
              Address
            </Text.Block>
          </label>
          <TextInput type="string" value="my address" onChange={() => 'asdasd'} wide required />
        </div>
        <div css="margin-bottom: 20px">
          <label>
            <Text.Block color={theme.textSecondary} smallcaps>
              Purchase ID
            </Text.Block>
          </label>
          <TextInput type="number" value={123} onChange={() => 'asdasdasd'} wide required />
        </div>
        <div css="padding-top: 10px;">
          <Button mode="strong" type="submit" wide>
            Refund
          </Button>
        </div>
        <Info css="margin-top: 1rem;">
          <p css="font-weight: 700;">Info</p>
          <p>
            The presale did not reach its goal. You can thus request for your contributions to get refunded. If you have made multiple contributions, you should
            request to get refunded for each of them.
          </p>
        </Info>
      </form>
    </SidePanel>
  )
}
