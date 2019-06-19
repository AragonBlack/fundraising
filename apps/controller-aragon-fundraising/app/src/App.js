import { useAragonApi } from '@aragon/api-react'
import { AppBar, useViewport, Viewport } from '@aragon/ui'
import React, { useState } from 'react'
import styled from 'styled-components'
import MenuButton from './components/MenuButton'
import TabMenuButton from './components/TabMenuButton'
import NewOrderSidePanel from './components/NewOrderSidePanel'
import Reserves from './screens/Reserves'
import Orders from './screens/Orders'
import Overview from './screens/Overview'
import AppView from './components/AppView/AppView'
import AppHeader from './components/AppHeader/AppHeader'
import Bar from './components/Bar/Bar'
import TabBar from './components/TabBar/TabBar'
import Button from './components/Button/Button'
import { useDarkMode } from './theme'
import Main from './components/Main/Main'

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
  const darkMode = useDarkMode()
  const [selected, setSelected] = useState(0)

  return (
    <div css="min-width: 320px">
      <AppView>
        <AppHeader
          heading="Fundraising"
          action={
            <Button mode="strong" label="New Order" onClick={() => setState({ ...state, displaySidePanel: true })}>
              New Order
            </Button>
          }
        />
        <Bar>
          <TabBar selected={selected} onChange={setSelected} items={['Overview', 'Orders', 'Reserves']} />
        </Bar>

        {selected === 0 && <Overview />}
        {selected === 1 && <Orders />}
        {selected === 2 && <Reserves />}
      </AppView>
      {/* <AppView
          title="Aragon Fundraising"
          padding={0}
          css={`
            background-color: #f9fafc;
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
                    <Button mode="strong" onClick={() => setState({ ...state, displaySidePanel: true })}>
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
          {currentTab === 'My Orders' && <Reserves />}
        </AppView> */}
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
