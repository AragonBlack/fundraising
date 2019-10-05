import React, { useContext } from 'react'
import { SidePanel } from '@aragon/ui'
import { PresaleViewContext } from '../../context'
import Refund from './Refund'

export default () => {
  // *****************************
  // context state
  // *****************************
  const { refundPanel, setRefundPanel } = useContext(PresaleViewContext)

  return (
    <SidePanel title="Refund Presale Shares" opened={refundPanel} onClose={() => setRefundPanel(false)}>
      <Refund />
    </SidePanel>
  )
}
