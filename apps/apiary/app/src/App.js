import { AppView, Main, TabBar, observe } from '@aragon/ui'
import { first, map } from 'rxjs/operators'

import React from 'react'
import AppLayout from './components/AppLayout'
// import NewRepositoryIcon from './components/NewRepositoryIcon'
import Orders from './screens/Orders'
import Overview from './screens/Overview'

const tabs = ['Overview', 'Buys / Sells', 'Settings']

class App extends React.Component {
  static defaultProps = {
    repos: [],
  }

  constructor(props) {
    super(props)
    // this.state = { repos: props.repos, sidePanelOpen: false }

    this.handleMenuPanelOpen = this.handleMenuPanelOpen.bind(this)
    this.handleSidePanelOpen = this.handleSidePanelOpen.bind(this)
    this.handleSidePanelClose = this.handleSidePanelClose.bind(this)
    this.handleCreateRepository = this.handleCreateRepository.bind(this)

    this.state = {
      tabIndex: 0,
      updateInformationsSidePanelOpen: false,
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

  handleSidePanelOpen() {
    this.setState({ sidePanelOpen: true })
  }

  handleSidePanelClose() {
    this.setState({ sidePanelOpen: false })
  }

  handleCreateRepository(name, description) {
    this.props.app.createRepository(name, description)
  }

  render() {
    const { tabIndex } = this.state
    const currentTab = tabs[tabIndex]

    return (
      <div css="min-width: 320px">
        <Main>
          <AppView title="Apiary" tabs={<TabBar items={tabs} selected={tabIndex} onChange={tabIndex => this.setState({ tabIndex })} />}>
            {currentTab === 'Overview' && <Overview />}
            {currentTab === 'Buys / Sells' && <Orders />}
          </AppView>
        </Main>
      </div>
    )
  }
}

export default observe(
  observable =>
    observable.pipe(
      map(state => {
        return { ...state }
      })
    ),
  {}
)(App)
