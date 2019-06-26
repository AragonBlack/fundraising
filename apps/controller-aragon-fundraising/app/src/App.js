import { useAragonApi } from '@aragon/api-react'
import PropTypes from 'prop-types'
import React from 'react'
import NewOrderSidePanel from './components/NewOrderSidePanel'
import Reserves from './screens/Reserves'
import Orders from './screens/Orders'
import Overview from './screens/Overview'
import AppView from './components/AppView/AppView'
import AppHeader from './components/AppHeader/AppHeader'
import Bar from './components/Bar/Bar'
import TabBar from './components/TabBar/TabBar'
import Button from './components/Button/Button'

const tabs = ['Overview', 'Orders', 'Reserve Settings']

class App extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    appState: PropTypes.object,
  }

  static defaultProps = {
    isSyncing: true,
    balances: [],
    orders: [],
    collateralTokens: [],
  }

  state = {
    orderAmount: 0.0,
    tokenAmount: 0.0,
    token: '0x00',
    tabIndex: 0,
    displaySidePanel: false,
  }

  handleNewOrderOpen = () => {
    this.setState({ displaySidePanel: true })
  }

  handleNewOrderClose = () => {
    this.setState({ displaySidePanel: false })
  }

  handlePlaceOrder = async (collateralTokenAddress, amount, isBuyOrder) => {
    // TODO: add error handling on failed tx, check token balances
    if (isBuyOrder) {
      console.log(`its a buy order where token: ${collateralTokenAddress}, amount: ${amount}`)
      this.props.api.createBuyOrder(collateralTokenAddress, amount).toPromise()
    } else {
      console.log(`its a sell order where token: ${collateralTokenAddress}, amount: ${amount}`)
      this.props.api.createSellOrder(collateralTokenAddress, amount).toPromise()
    }

    this.handleNewOrderClose()
  }

  handleTokenTapUpdate = async (tapAmount) => {
    const { token } = this.state
    this.props.api.updateTokenTap(token, tapAmount).toPromise(err => console.log('You do not have permissions to update this value: ', err))
  }

  render() {
    const { tabIndex, displaySidePanel, orderAmount, tokenAmount, token } = this.state
    return (
      <div css="min-width: 320px">
        <AppView>
          <AppHeader
            heading="Fundraising"
            action={
              <Button mode="strong" label="New Order" onClick={this.handleNewOrderOpen}>
                New Order
              </Button>
            }
          />
          <Bar>
            <TabBar selected={tabIndex} onChange={tabIndex => this.setState({ tabIndex })} items={tabs} />
          </Bar>
          {tabIndex === 0 && <Overview />}
          {tabIndex === 1 && <Orders />}
          {tabIndex === 2 && <Reserves updateTokenTap={this.handleTokenTapUpdate} />}
        </AppView>
        <NewOrderSidePanel
          orderAmount={orderAmount}
          tokenAmount={tokenAmount}
          token={token}
          price={300.0}
          opened={displaySidePanel}
          onClose={this.handleNewOrderClose}
          onSubmit={this.handlePlaceOrder}
        />
      </div>
    )
  }
}

export default () => {
  const { api, appState } = useAragonApi()
  return <App api={api} appState={appState} isSyncing={appState.isSyncing} />
}
