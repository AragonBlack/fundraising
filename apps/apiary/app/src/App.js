import { useAragonApi } from '@aragon/api-react'
import { AppBar, AppView, Button, Main, observe, TabBar } from '@aragon/ui'
import React, { useState } from 'react'
import { map } from 'rxjs/operators'
import styled from 'styled-components'
import MenuButton from './components/MenuButton'
import NewOrderSidePanel from './components/NewOrderSidePanel'
// import NewRepositoryIcon from './components/NewRepositoryIcon'
import Orders from './screens/Orders'
import Overview from './screens/Overview'

const tabs = ['Overview', 'Buys / Sells', 'Settings']

const App = () => {
  const [state, setState] = useState({
    repos: [],
    amount: '',
    token: '',
    tabIndex: 0,
    displaySidePanel: false,
  })
  const { requestMenu, displayMenuButton } = useAragonApi()
  const { tabIndex, displaySidePanel, amount, token } = state
  const currentTab = tabs[tabIndex]

  return (
    <div css="min-width: 320px">
      <Main>
        <AppView
          title="Apiary"
          appBar={
            <NavBar>
              <AppBar>
                <AppBarContainer style={{ paddingLeft: '30px' }}>
                  <Title>
                    {displayMenuButton && <MenuButton onClick={requestMenu} />}
                    <TitleLabel>Apiary</TitleLabel>
                  </Title>
                  <NewOrder>
                    <Button mode="strong" onClick={() => setState({ ...state, displaySidePanel: true })}>
                      New Order
                    </Button>
                  </NewOrder>
                </AppBarContainer>
              </AppBar>
              <TabBar items={tabs} selected={tabIndex} onChange={tabIndex => setState({ ...state, tabIndex })} />
            </NavBar>
          }
        >
          {currentTab === 'Overview' && <Overview />}
          {currentTab === 'Buys / Sells' && <Orders />}
        </AppView>
      </Main>
      <NewOrderSidePanel
        amount={amount}
        token={token}
        price={'300.00'}
        opened={displaySidePanel}
        onClose={() => setState({ ...state, displaySidePanel: false })}
        onSubmit={() => console.log('Handle submit')}
      />
    </div>
  )
}

const NewOrder = styled.h1`
  position: absolute;
  z-index: 3;
  padding: 20px;
  right: 0;
`

const NavBar = styled.div`
  background-color: #ffffff;

  span {
    white-space: nowrap;
  }
`

const AppBarContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  justify-content: space-between;
  align-items: center;
  flex-wrap: nowrap;
`

const Title = styled.h1`
  display: flex;
  flex: 1 1 auto;
  width: 0;
  align-items: center;
  height: 100%;
`

const TitleLabel = styled.span`
  flex: 0 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 10px;
  font-size: 22px;
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
