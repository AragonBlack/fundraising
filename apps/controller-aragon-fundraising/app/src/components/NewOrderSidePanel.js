import { Button, DropDown, Field, SidePanel, TabBar, Table, TableCell, TableRow, Text, TextInput } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'
import transferArrows from '../assets/transferArrows.png'

const collateralTokens = ['DAI', 'ANT']

const styles = {
  selectionInputLeft: {
    borderRadius: '3px 0px 0px 3px',
    textAlign: 'right',
    padding: 0,
    paddingLeft: 0
  },
  selectionInputRight: {
    textAlign: 'right',
    paddingRight: '50px'
  },
  noBorderCell: {
    borderBottom: 0,
    borderTop: 0,
    padding: 0
  },
  maxBalanceLink: {
    paddingLeft: '14px',
    textDecoration: 'underline',
    cursor: 'pointer'
  }
}

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
        <Form onSubmit={this.handleSubmit}>
          <Table noSideBorders={true} >
            <TableRow>
              <TableCell style={styles.noBorderCell}>
                <Field css={fieldCss} label="Order Amount">
                  <TextInput
                    adornment={<a style={styles.maxBalanceLink}>MAX</a>}
                    type="number"
                    style={styles.selectionInputLeft}
                    ref={amount => (this.amountInput = amount)}
                    value={amount}
                    onChange={this.handleAmountChange}
                    wide
                    required
                  />
                </Field>
                <StyledDropdown>
                  <DropDown items={collateralTokens} active={activeItem}  onChange={this.handleTokenChange} />
                </StyledDropdown>
              </TableCell>
              <TableCell style={styles.noBorderCell}>
                <img src={transferArrows} style={{ width: '40px', display: 'flex' }} />
                <Field css={fieldCss} label="Token Amount">
                  <TextInput
                    style={styles.selectionInputRight}
                    adornment={<span style={{ paddingRight: '14px'}}>ANT</span>}
                    adornmentPosition={"end"}
                    ref={amount => (this.amountInput = amount)}
                    value={amount}
                    onChange={this.handleAmountChange}
                    required
                    wide
                  />
                </Field>
              </TableCell>
            </TableRow>
          </Table>
          <Button mode="strong" type="submit" wide onClick={onSubmit}>
            {activeTab === 0 ? 'Place buy order' : 'Place sell order'}
          </Button>
        </Form>
      </SidePanel>
    )
  }
}
const StyledDropdown = styled.div`
  > div {
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
  }
  > div > div {
    padding-right: 26px;
    border-radius: 0 3px 3px 0;
    border-left: 0px;
    margin-top: 1px;
  }
`
const Form = styled.form`
  margin-top: 20px;
`

const TabBarWrapper = styled.div`
  margin: 0 -30px 30px;
`

const fieldCss = `
  > label > div {
    width: auto;
  }
`
