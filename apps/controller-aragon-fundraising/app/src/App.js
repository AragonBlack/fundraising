import { useAragonApi } from '@aragon/api-react'
import { AppBar, AppView, Button, Main, TabBar, useViewport, Viewport } from '@aragon/ui'
import React, { useState } from 'react'
import styled from 'styled-components'
import MenuButton from './components/MenuButton'
import TabMenuButton from './components/TabMenuButton'
import NewOrderSidePanel from './components/NewOrderSidePanel'
import MyOrders from './screens/MyOrders'
import Orders from './screens/Orders'
import Overview from './screens/Overview'

const tabs = ['Overview', 'Buys / Sells', 'My Orders', 'Settings']

const App = () => {
  const [state, setState] = useState({
    amount: '',
    token: '',
    tabIndex: 0,
    displaySidePanel: false,
    showTab: false,
  })
  const { requestMenu, displayMenuButton } = useAragonApi()
  const { below } = useViewport()
  const { tabIndex, displaySidePanel, amount, token, showTab } = state
  const currentTab = tabs[tabIndex]

  return (
    <div css="min-width: 320px">
      <Main>
        <AppView
          title="Aragon Fundraising"
          padding={0}
          css={`
            background-color: white;
          `}
          appBar={
            <NavBar>
              <AppBar>
                <AppBarContainer style={{ paddingLeft: displayMenuButton ? '0px' : '30px' }}>
                  <Title>
                    {displayMenuButton && <MenuButton onClick={requestMenu} />}
                    <TitleLabel>Aragon Fundraising</TitleLabel>
                  </Title>
                  <NewOrder>
                    <Button mode="strong" style={{ width: '140px' }} onClick={() => setState({ ...state, displaySidePanel: true })}>
                      New Order
                    </Button>
                  </NewOrder>
                </AppBarContainer>
              </AppBar>

              <Viewport>
                {({ below }) => (
                  <div>
                    {below('small') && <TabMenuButton onClick={() => setState({ ...state, showTab: !showTab })} />}
                    <div
                      css={
                        below('small') &&
                        !showTab &&
                        `
                          overflow: hidden;
                          height: 0;
                        `
                      }
                    >
                      <TabBar items={tabs} selected={tabIndex} onChange={tabIndex => setState({ ...state, tabIndex })} />
                    </div>
                  </div>
                )}
              </Viewport>
            </NavBar>
          }
        >
          {currentTab === 'Overview' && <Overview />}
          {currentTab === 'Buys / Sells' && <Orders />}
          {currentTab === 'My Orders' && <MyOrders />}
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
  display: block;
  padding: 0 30px;
  justify-content:center;
`

const NavBar = styled.div`
  background-color: #ffffff;

  span {
    white-space: nowrap;
  }

  @media only screen and (max-width: 540px) {
    ul {
      flex-direction: column;
    }

    ul li {
      margin-bottom: 1rem;
    }

    ul li span {
      display: initial;
    }
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

export default App
