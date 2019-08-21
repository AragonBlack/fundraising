import { Button, SidePanel, Text, TextInput } from '@aragon/ui'
import React from 'react'
import styled from 'styled-components'
import transferArrows from '../assets/transferArrows.svg'

const amount = 0

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
    color: '#08BEE5',
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

  handleSubmit = (event, isBuyOrder) => {
    event.preventDefault()
    this.props.onSubmit(this.state.token.trim(), this.state.tokenAmount, isBuyOrder)
  }

  render() {
    const { orderAmount, tokenAmount, activeItem, activeTab } = this.state
    const { opened, onClose, onSubmit, price } = this.props
    const isBuyOrder = activeTab === 0

    const renderOrderType = (activeTab, onSubmit) => {
      return (
        <div>
          <div>
            <Text weight="bold">TOTAL</Text>
            <div
              css={`
                float: right;
                display: flex;
                justify-content: space-between;
                width: 3.5rem;
              `}
            >
              <Text weight="bold">0</Text>
              <Text weight="bold">{isBuyOrder ? 'ATL' : 'USD'}</Text>
            </div>
          </div>
          <div css="margin-bottom: 2rem;">
            <Text weight="bold" />
            <div
              css={`
                float: right;
                display: flex;
                justify-content: space-between;
                width: 3.5rem;
              `}
            >
              <Text color="grey">0</Text>
              <Text color="grey">{isBuyOrder ? 'USD' : 'ATL'}</Text>
            </div>
          </div>
          <Button mode="strong" type="submit" css="width: 100%;" onClick={onSubmit}>
            {isBuyOrder ? 'Place buy order' : 'Place sell order'}
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
              For a {isBuyOrder ? 'buying' : 'selling'} order, the more collateral is staked into the bonding curve, you may opt to sell a small share of your
              tokens in order to redeem collateral from the contract and fund the development of the project.
            </p>
          </div>
        </div>
      )
    }

    return (
      <SidePanel title="Buy Presale Tokens" opened={opened} onClose={onClose}>
        <div css="margin: 0 -30px 30px; border: 1px solid #DFE3E8;" />
        <Form onSubmit={e => this.handleSubmit(e, isBuyOrder)}>
          <div className="fields">
            <div>
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
                  > div {
                    width: 100%;
                  }
                `}
              >
                <StyledTextInput
                  adornment={<span css="padding-right: 14px;">DAI</span>}
                  adornmentPosition={'end'}
                  type="number"
                  style={styles.selectionInputRight}
                  ref={amount => (this.amountInput = amount)}
                  value={amount}
                  onChange={() => {}}
                  wide
                  required
                />
              </div>
            </div>

            <img src={transferArrows} className="arrows" />

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
                  onChange={() => {}}
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

const Form = styled.form`
  display: block;

  .fields {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3rem;
  }

  .arrows {
    height: 16px;
    margin: 0 0.5rem;
    margin-top: 1rem;
  }

  @media only screen and (max-width: 424px) {
    .fields {
      flex-direction: column;
    }

    .arrows {
      margin-bottom: 0.75rem;
    }
  }
`
