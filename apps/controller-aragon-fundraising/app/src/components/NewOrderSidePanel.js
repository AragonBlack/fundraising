import { Button, DropDown, Field, Info, SidePanel, TabBar, Table, TableCell, TableRow, Text, TextInput } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'
import transferArrows from '../assets/transferArrows.svg'

const formatOrderRequirements = value => {
  return value.length > 0 && value > 0 ? value : '0.00'
}

const collateralTokens = ['DAI', 'ANT']

const styles = {
  selectionInputLeft: {
    borderRadius: '3px 0px 0px 3px',
    textAlign: 'right',
    width: '150px',
    paddingLeft: 0,
  },
  selectionInputRight: {
    textAlign: 'right',
    paddingRight: '50px',
  },
  noBorderCell: {
    borderBottom: 0,
    borderTop: 0,
    padding: 0,
  },
  maxBalanceLink: {
    paddingLeft: '14px',
    textDecoration: 'underline',
    cursor: 'pointer',
    color: '#1DD9D5',
  },
  daiPrice: {
    position: 'relative',
    display: 'inline-block',
    top: '-12px',
    left: '3rem',
  },
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
      orderAmount: props.orderAmount,
      tokenAmount: props.tokenAmount,
      token: props.token,
    }

    this.handleTokenChange = this.handleTokenChange.bind(this)
  }

  componentWillReceiveProps({ opened, orderAmount, tokenAmount, token, price }) {
    this.setState({ orderAmount: orderAmount, tokenAmount: tokenAmount, token: token, price: price })
    if (opened && !this.props.opened) {
      // setTimeout is needed as a small hack to wait until the input's on
      // screen until we call focus
      this.amountInput && setTimeout(() => this.amountInput.focus(), 0)
    }
  }

  // TODO: create condition for ANT token price / abstract for any token price listed
  handleOrderAmountChange = event => {
    const tokenAmount = (event.target.value / this.props.price).toFixed(2)
    this.setState({ orderAmount: formatOrderRequirements(event.target.value), tokenAmount })
  }

  handleTokenAmountChange = event => {
    const orderAmount = (event.target.value * this.props.price).toFixed(2)
    this.setState({ tokenAmount: formatOrderRequirements(event.target.value), orderAmount })
  }

  handleTokenChange(index) {
    const token = collateralTokens[index]
    // const tokenAddress = collateralTokenAddress[token]
    //
    // this.setState(
    this.setState({ activeItem: index })
  }

  handleSubmit = (event, orderType) => {
    event.preventDefault()
    this.props.onSubmit(this.state.token.trim(), this.state.tokenAmount.trim(), orderType)
  }

  render() {
    const { orderAmount, tokenAmount, activeItem, activeTab } = this.state
    const { opened, onClose, onSubmit, price } = this.props

    const renderOrderType = (activeTab, onSubmit) => {
      const orderType = activeTab === 0
      return (
        <div>
          <FlexWrapper>
            <Text weight="bold">TOTAL</Text>
            <Text weight="bold">{orderType ? tokenAmount : orderAmount}</Text>
            <Text weight="bold">{orderType ? 'ATL' : 'USD'}</Text>
          </FlexWrapper>
          <FlexWrapper>
            <Text weight="bold" />
            <Text color="grey">{orderType ? orderAmount : tokenAmount}</Text>
            <Text color="grey">{orderType ? 'USD' : 'ATL'}</Text>
          </FlexWrapper>
          <Button mode="strong" type="submit" wide onClick={e => this.handleSubmit(e, orderType)}>
            {orderType ? 'Place buy order' : 'Place sell order'}
          </Button>
          <Info.Action style={{ marginTop: '20px' }} title={orderType ? 'Buy order' : 'Sell order'}>
            As more collateral is staked into the bonding curve, you may opt to sell a small share of your tokens in order to redeem your collateral from the
            contract where a percentage fee goes to the development of the project.
          </Info.Action>
        </div>
      )
    }

    return (
      <SidePanel title="New Order" opened={opened} onClose={onClose}>
        <TabBarWrapper>
          <TabBar items={['Buy', 'Sell']} selected={activeTab} onChange={idx => this.setState({ activeTab: idx })} />
        </TabBarWrapper>
        <Form onSubmit={e => this.handleSubmit(e, activeTab === '0')}>
          <Table noSideBorders>
            <TableRow>
              <TableCell
                style={styles.noBorderCell}
                css={`
                  justify-content: flex-start;
                  white-space: nowrap;
                `}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Field css={fieldCss} label="Order Amount">
                    <TextInput
                      adornment={<a style={styles.maxBalanceLink}>MAX</a>}
                      style={styles.selectionInputLeft}
                      ref={amount => (this.amountInput = amount)}
                      value={orderAmount}
                      onChange={this.handleOrderAmountChange}
                      wide
                      required
                    />
                  </Field>
                  <StyledDropdown>
                    <DropDown items={collateralTokens} active={activeItem} onChange={this.handleTokenChange} />
                  </StyledDropdown>
                </div>
              </TableCell>
              <TableCell
                style={styles.noBorderCell}
                css={`
                  justify-content: flex-start;
                  white-space: nowrap;
                `}
              >
                <img src={transferArrows} style={{ height: '16px', margin: '0 0.5rem' }} />
                <Field css={fieldCss} label="Token Amount">
                  <TextInput
                    style={styles.selectionInputRight}
                    adornment={<span style={{ paddingRight: '14px' }}>ATL</span>}
                    adornmentPosition={'end'}
                    ref={amount => (this.amountInput = amount)}
                    value={tokenAmount}
                    onChange={this.handleTokenAmountChange}
                    required
                    wide
                  />
                </Field>
              </TableCell>
            </TableRow>
            <Text color={'rgb(150, 150, 150)'} size="small" style={styles.daiPrice}>
              ${price} USD
            </Text>
          </Table>
          {renderOrderType(activeTab, onSubmit)}
        </Form>
      </SidePanel>
    )
  }
}

const FlexWrapper = styled.div`
  display: flex;
  margin-bottom: 10px;

  span:first-child {
    flex: 0 1 326px;
  }

  span:last-child {
    margin-left: 1.5rem;
  }
`
const StyledDropdown = styled.div`
  height: 40px;
  > div {
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
  }
  > div > div {
    padding-right: 26px;
    border-radius: 0 3px 3px 0;
    border-left: 0px;
    margin-top: 1px;
  }
`
const Form = styled.form`
  display: block;
`

const TabBarWrapper = styled.div`
  margin: 0 -30px 30px;
`

const fieldCss = `
  > label > div {
    width: auto;
  }
`
