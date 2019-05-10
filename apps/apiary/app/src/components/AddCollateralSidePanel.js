import React from 'react'
import styled from 'styled-components'
import { Table, Text, Button, SidePanel, TextInput, Field } from '@aragon/ui'

export default class AddCollateralSidePanel extends React.Component {
    static defaultProps = {
	tokenAddress: '',
	collateralRatio: '',
	tapRate: '',
	onClose: () => {},
	onSubmit: () => {},
    }
    constructor(props) {
      super(props)
      this.state = {
        tokenAddress: props.tokenAddress,
        collateralRatio: props.collateralRatio,
        tapRate: props.tapRate,
      }

      this.handleTokenAddressChange = this.handleTokenAddressChange.bind(this)
      this.handleCollateralRatioChange = this.handleCollateralRatioChange.bind(this)
      this.handleTapRateChange = this.handleTapRateChange.bind(this)
    }

    componentWillReceiveProps({ opened, tokenAddress, collateralRate, tapRate }) {
      this.setState({ tokenAddress: tokenAddress, collateralRate: collateralRate, tapRate: tapRate })
      if (opened && !this.props.opened) {
        // setTimeout is needed as a small hack to wait until the input's on
        // screen until we call focus
	//TODO: Any way we can make this into a helper library?
        this.tokenAddressInput && setTimeout(() => this.tokenAddressInput.focus(), 0)
        this.collateralRatioInput && setTimeout(() => this.collateralRatioInput.focus(), 0)
        this.tapRateInput  && setTimeout(() => this.tapRateInput.focus(), 0)
      }
    }

    handleTokenAddressChange = event => {
      this.setState({ tokenAddress: event.target.value })
    }

    handleCollateralRatioChange = event => {
      this.setState({ collateralRatio: event.target.value })
    }

    handleTapRateChange = event => {
      this.setState({ tapRate: event.target.value })
    }

    handleSubmit = event => {
      event.preventDefault()
      this.props.onSubmit(this.state.tokenAddress.trim(), this.state.collateralRatio.trim(), this.state.tapRate.trim())
    }

    render() {
      const { tokenAddress, collateralRatio, tapRate } = this.state
      const { opened, onClose, onSubmit } = this.props

      return (
        <SidePanel title="Add collateral token" opened={opened} onClose={onClose}>
          <Form onSubmit={this.handleSubmit}>
            <Field label="Address">
              <TextInput
                ref={tokenAddress => (this.tokenAddressInput = tokenAddress )}
                value={tokenAddress}
                onChange={this.handleTokenAddressChange}
                required wide
              />
            </Field>
	    <Table noSideBorders={true}>
            <Field label="Collateral Ratio">
              <TextInput
                ref={collateralRatio => (this.collateralRatioInput = collateralRatio )}
                value={collateralRatio}
                onChange={this.handleCollateralRatioChange}
                required
              />
            </Field>
            <Field label="Tap Rate">
              <TextInput
                ref={tapRate => (this.tapRateInput = tapRate )}
                value={tapRate}
                onChange={this.handleTapRateChange}
                required
              />
            </Field>
	    </Table>
            <Button mode="strong" type="submit" wide onClick={onSubmit}>
              Add collateral token
            </Button>
          </Form>
        </SidePanel>
      )
    }
}

const Form = styled.form`
margin-top: 20px;
`


