import { Button, DropDown, Field, SidePanel, TabBar, Text, TextInput } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'

const collateralTokens = ['DAI', 'ANT']

export default class NewOrderSidePanel extends React.Component {
  static defaultProps = {
    amount: '',
    token: '',
    price: '',
    onClose: () => {},
    onSubmit: () => {},
  }

  constructor(props) {
    super(props)

    this.state = {
      activeTab: 0,
      activeItem: 0,
      amount: props.amount,
      token: props.token,
    }

    this.handleTokenChange = this.handleTokenChange.bind(this)
  }

  componentWillReceiveProps({ opened, amount, token, price }) {
    this.setState({ amount: amount, token: token, price: price })
    if (opened && !this.props.opened) {
      // setTimeout is needed as a small hack to wait until the input's on
      // screen until we call focus
      this.amountInput && setTimeout(() => this.amountInput.focus(), 0)
    }
  }

  handleAmountChange = event => {
    this.setState({ amount: event.target.value })
  }

  handleTokenChange(index) {
    const token = collateralTokens[index]
    this.setState({ activeItem: index })
  }

  handleSubmit = event => {
    event.preventDefault()
    this.props.onSubmit(this.state.amount.trim(), this.state.token.trim())
  }

  render() {
    const { amount, token, activeItem, activeTab } = this.state
    const { opened, onClose, onSubmit, price } = this.props

    return (
      <SidePanel title="New Order" opened={opened} onClose={onClose}>
        <TabBarWrapper>
          <TabBar items={['Buy', 'Sell']} selected={activeTab} onChange={idx => this.setState({ activeTab: idx })} />
        </TabBarWrapper>
        <Text size={'small'}>Price: {'$' + price}</Text>
        <Form onSubmit={this.handleSubmit}>
          <Field label="Amount">
            <TextInput type="number" ref={amount => (this.amountInput = amount)} value={amount} onChange={this.handleAmountChange} required wide />
          </Field>
          <Field label="Collateral Token">
            <DropDown items={collateralTokens} active={activeItem} onChange={this.handleTokenChange} />
          </Field>
          <Button mode="strong" type="submit" wide onClick={onSubmit}>
            {activeTab === 0 ? 'Create buy order' : 'Create sell order'}
          </Button>
        </Form>
      </SidePanel>
    )
  }
}

const Form = styled.form`
  margin-top: 20px;
`

const TabBarWrapper = styled.div`
  margin: 0 -30px 30px;
`
