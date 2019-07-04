import { DropDown, SidePanel, Text, TextInput } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'
import transferArrows from '../assets/transferArrows.svg'
import TabBar from './TabBar/TabBar'
import Button from './Button/Button'

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
          <div>
            <Text weight="bold">TOTAL</Text>
            <div css="float: right;">
              <Text weight="bold" css={orderType ? 'margin-right: 1.5rem;' : 'margin-right: 21px;'}>
                0
              </Text>
              <Text weight="bold">{orderType ? 'ATL' : 'USD'}</Text>
            </div>
          </div>
          <div css="margin-bottom: 2rem;">
            <Text weight="bold" />
            <div css="float: right;">
              <Text color="grey" css={orderType ? 'margin-right: 21px;' : 'margin-right: 1.5rem;'}>
                0
              </Text>
              <Text color="grey">{orderType ? 'USD' : 'ATL'}</Text>
            </div>
          </div>
          <Button mode="strong" type="submit" css="width: 100%;" onClick={onSubmit}>
            {orderType ? 'Place buy order' : 'Place sell order'}
          </Button>
          <div
            css={`
              background-color: #f1fbff;
              border-radius: 4px;
              color: #188aaf;
              padding: 1rem;
              margin-top: 2rem;
              border-left: 2px solid #0ab0e5;
            `}
          >
            <p css="font-weight: 700;">Info</p>
            <p>
              For a {orderType ? 'buying' : 'selling'} order, the more collateral is staked into the bonding curve, you may opt to sell a small share of your
              tokens in order to redeem collateral from the contract and fund the development of the project.
            </p>
          </div>
        </div>
      )
    }

    return (
      <SidePanel title="New Order" opened={opened} onClose={onClose}>
        <TabBarWrapper>
          <TabBar items={['Buy', 'Sell']} selected={activeTab} onChange={idx => this.setState({ activeTab: idx })} />
        </TabBarWrapper>
        <Form onSubmit={this.handleSubmit}>
          <div
            css={`
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 3rem;
            `}
          >
            <div css="width: 50%;">
              <p
                css={`
                  text-transform: uppercase;
                  color: #637381;
                  font-size: 14px;
                  opacity: 0.7;
                `}
              >
                Order amount
              </p>
              <div
                css={`
                  display: flex;
                  align-items: center;
                `}
              >
                <StyledTextInput
                  adornment={<a style={styles.maxBalanceLink}>MAX</a>}
                  type="number"
                  style={styles.selectionInputLeft}
                  ref={amount => (this.amountInput = amount)}
                  value={amount}
                  onChange={this.handleAmountChange}
                  wide
                  required
                />
                <StyledDropdown>
                  <DropDown items={collateralTokens} active={activeItem} onChange={this.handleTokenChange} />
                </StyledDropdown>
              </div>
            </div>

            <img
              src={transferArrows}
              css={`
                height: 16px;
                margin: 0 0.5rem;
                margin-top: 1rem;
              `}
            />

            <div
              css={`
                display: flex;
                align-items: center;
                white-space: nowrap;
              `}
            >
              <div
                css={`
                  > div {
                    width: 100%;
                  }
                `}
              >
                <p
                  css={`
                    text-transform: uppercase;
                    color: #637381;
                    font-size: 14px;
                    opacity: 0.7;
                  `}
                >
                  Token amount
                </p>
                <StyledTextInput
                  type="number"
                  style={styles.selectionInputRight}
                  adornment={<span style={{ paddingRight: '14px' }}>ATL</span>}
                  adornmentPosition={'end'}
                  ref={amount => (this.amountInput = amount)}
                  value={amount}
                  onChange={this.handleAmountChange}
                  required
                  wide
                />
              </div>
            </div>
          </div>

          {renderOrderType(activeTab, onSubmit)}
        </Form>
      </SidePanel>
    )
  }
}

const StyledTextInput = styled(TextInput)`
  border: 1px solid #dde4e9;
  box-shadow: none;
  width: 100%;
`
const StyledDropdown = styled.div`
  > div {
    box-shadow: none;
  }

  > div > div:first-child {
    padding-right: 26px;
    border-radius: 0 3px 3px 0;
    border: 1px solid #dde4e9;
    border-left: none;
    height: 40px;
  }
`
const Form = styled.form`
  display: block;
`

const TabBarWrapper = styled.div`
  margin: 0 -30px 30px;
`
