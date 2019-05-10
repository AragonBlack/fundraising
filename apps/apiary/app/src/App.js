import { AppView, Main, TabBar, Button, observe } from '@aragon/ui'
import { first, map } from 'rxjs/operators'
import styled from 'styled-components'
import React from 'react'
import NewOrderSidePanel from './components/NewOrderSidePanel'
import AddCollateralSidePanel from './components/AddCollateralSidePanel'
import Orders from './screens/Orders'
import Overview from './screens/Overview'
import CollateralSettings from './screens/CollateralSettings'

const tabs = ['Overview', 'Buys / Sells', 'Collateral Settings']

class App extends React.Component {
  static defaultProps = {
    repos: [],
    amount: '',
    token: '',
    collateralTokens: [],
    addTokenAddress: '',
    collateralRatio: 0,
    tapRate: 0
  }

  constructor(props) {
    super(props)
    // this.state = { repos: props.repos, sidePanelOpen: false }

    this.handleMenuPanelOpen = this.handleMenuPanelOpen.bind(this)
    this.handleOrderSidePanelOpen = this.handleOrderSidePanelOpen.bind(this)
    this.handleOrderSidePanelClose = this.handleOrderSidePanelClose.bind(this)
    this.handleCollateralSidePanelOpen = this.handleCollateralSidePanelOpen.bind(this)
    this.handleCollateralSidePanelClose = this.handleCollateralSidePanelClose.bind(this)
    this.handleCreateRepository = this.handleCreateRepository.bind(this)

    this.state = {
      tabIndex: 0,
      updateOrderSidePanelOpen: false,
      updateCollateralSidePanelOpen: false
    }
  }

  componentDidMount() {
    this.deriveReposInformationsFromProps(this.props)
  }

  componentWillReceiveProps(props) {
    this.deriveReposInformationsFromProps(props)
  }

  deriveReposInformationsFromProps(props) {
    const repos = []
    const requests = []

    try {
      for (const repo of props.repos) {
        const contract = props.app.external(repo, PandoRepository.abi)
        requests.push(this.loadRepoInformations(contract))
      }
    } catch (err) {
      console.error('Failed to set repos informations due to:', err)
    }

    Promise.all(requests)
      .then(results => {
        for (const index in results) {
          const [name, description] = results[index]
          repos.push({ address: props.repos[index], name, description })
        }
        this.setState({ repos })
      })
      .catch(err => {
        console.error('Failed to set repos informations due to:', err)
      })
  }

  loadRepoName(repoContract) {
    return new Promise((resolve, reject) => {
      repoContract
        .name()
        .pipe(first())
        .subscribe(resolve, reject)
    })
  }

  loadRepoDescription(repoContract) {
    return new Promise((resolve, reject) => {
      repoContract
        .description()
        .pipe(first())
        .subscribe(resolve, reject)
    })
  }

  loadRepoInformations(repoContract) {
    return Promise.all([this.loadRepoName(repoContract), this.loadRepoDescription(repoContract)])
  }

  handleMenuPanelOpen() {
    this.props.sendMessageToWrapper('menuPanel', true)
  }

  handleOrderSidePanelOpen() {
    this.setState({ updateOrderSidePanelOpen: true })
  }

  handleOrderSidePanelClose() {
    this.setState({ updateOrderSidePanelOpen: false })
  }
  
  handleCollateralSidePanelOpen() {
    this.setState({ updateCollateralSidePanelOpen: true })
  }

  handleCollateralSidePanelClose() {
    this.setState({ updateCollateralSidePanelOpen: false })
  }

  handleCreateRepository(name, description) {
    this.props.app.createRepository(name, description)
  }

  handleUpdateOrder(amount, token) {
    //this.props.app.createOrder(amount, token)
  }

  handleUpdateAddCollateral(tokenAddress, collateralRatio, tapRate) {
    //this.props.app.addToken(tokenAddress, collateralRatio, tapRate)
  }

  render() {
    const { tabIndex, updateOrderSidePanelOpen, updateCollateralSidePanelOpen } = this.state
    const { amount, token, addTokenAddress, collateralRatio, tapRate, collateralTokens } = this.props
    const currentTab = tabs[tabIndex]

    return (
      <div css="min-width: 320px">
        <NewOrder><Button mode="strong" wide onClick={this.handleOrderSidePanelOpen}>New Order</Button></NewOrder>
        <Main>
          <AppView title="Apiary" tabs={<TabBar items={tabs} selected={tabIndex} onChange={tabIndex => this.setState({ tabIndex })} />}>
            {currentTab === 'Overview' && <Overview />}
            {currentTab === 'Buys / Sells' && <Orders />}
            {currentTab === 'Collateral Settings' && <CollateralSettings collateralTokens={collateralTokens} handleSidePanel={this.handleCollateralSidePanelOpen}/>}
          </AppView>
        </Main>
        <NewOrderSidePanel
            amount={amount}
            token={token}
            price={"300.00"}
            opened={updateOrderSidePanelOpen}
            onClose={this.handleOrderSidePanelClose}
            onSubmit={this.handleUpdateOrder}
          />
          <AddCollateralSidePanel
		        tokenAddress={addTokenAddress}
		        collateralRatio={collateralRatio}
		        tapRate={tapRate}
		        opened={updateCollateralSidePanelOpen}
		        onClose={this.handleCollateralSidePanelClose}
		        onSubmit={this.handleUpdateAddCollateral}
		      />
      </div>
    )
  }
}

const NewOrder = styled.div`
  position: absolute;
  width: auto;
  height: auto; 
  overflow:hidden;
  z-index: 3;
  padding:20px;
  right: 0;
`

export default observe(
  observable =>
    observable.pipe(
      map(state => {
        return { ...state }
      })
    ),
  {}
)(App)
