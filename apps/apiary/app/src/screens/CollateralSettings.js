import { theme, Button, Badge, Table, TableHeader, TableRow, Text, DropDown } from '@aragon/ui';
import React from 'react';
import styled from 'styled-components'

const tapRateIntervals = ['Monthly', 'Quarterly', 'Yearly']

const tableInfo = [
    {
        name: 'Collateral Ratio',
        data: '$199,333.88'
    },
    {
        name: 'Tap rate (per month)',
        data: '$9,222.81'
    },
    {
        name: 'Total',
        data: '$33,333.88'
    },
    {
        name: 'Token gains',
        data: '$103,211,689.44'
    }
]

export default class CollateralSettings extends React.Component  {
    static defaultProps = {
        appToken: 'ATL',
        collateralTokens: [],
        handleSidePanel: () => {}
    }
    constructor(props) {
        super(props)
        this.handleTapRateChange = this.handleTapRateChange.bind(this)
        this.handleSidePanel = this.props.handleSidePanel.bind(this)
	//TODO: when we wire up the contracts this could only have a single state which is the collateral list. It would retreve and render from the data supplied by the app cache
	// Ideally, the side panel could also be a pure component that just executes the tx and then updates this components array of collateralized assets
	// Then block the user from adding anymore once there is size(tokens) < 5
        this.state = {
            activeItem: 0,
            tapRateInterval: '',
        }
    }
    handleTapRateChange(index) {
        const tapRate = tapRateIntervals[index];
        //caculate rate
        this.setState({ activeItem: index })
    }
    handleUpdateCollateralSettings(tokenAddress, collateralRatio, tapRate) {
      //this.props.app.addToken(tokenAddress, collateralRatio, tapRate)
    }

    render() {
        const { appToken } = this.props
        const { activeItem } = this.state
        const tableRowStyle = { height: '2rem' }
        return (
            <div>
                <CollateralTitle>
                    <Text>Collateralize and generate</Text>
                    <Badge style={{ marginLeft: '10px'}}>{appToken}</Badge>
                </CollateralTitle>
                <TableContainer>
                  <Table style={{ float: 'left', width: '65%' }}>
                        <Column>
                            <TableHeader title="Collateral Ratio" />
                            <Cell>
                                <Text>0.00</Text>
                                <Text style={{ float: 'right'}}>ETH</Text>
                            </Cell>
                        </Column>
                        <Column>
                            <TableHeader title="Token" />
                            <Cell>
                                <Text>0.00</Text>
                                <Text style={{ float: 'right'}}>{appToken}</Text>
                            </Cell>
                        </Column>
                    <Button onClick={this.handleSidePanel} style={{ margin: '20px' }}>Add Collateral Token</Button>
                  </Table>
                  <Table noSideBorders={true} style={{ padding: '1rem', float: 'left', width: '35%'}}>
                      <TableRow style={tableRowStyle}>
                          <Text>Bonding Curve Supply</Text>
                      </TableRow>
                      {tableInfo.map((row, i) => {
                        return (
                                <TableRow key={i} style={tableRowStyle}>
                                    <Text color={theme.textSecondary}>{row.name}</Text>
                                    <Text style={{ float: 'right' }}>{row.data}</Text>
                                    {i == 1 ? <hr style={{ color: theme.contentBorderActive }}/> : null} 
                                </TableRow>
                            )
                        })
                      }           
                      <TableRow style={{ height: '16rem' }}>
                          <Text color={theme.textSecondary} style={{ marginRight: '1rem'}}>Tap</Text>
                          <DropDown items={tapRateIntervals} active={activeItem} onChange={this.handleTapRateChange}/>
                      </TableRow>
                  </Table>
                </TableContainer>
            </div>
        )
    }
}

const Column = styled.div`
  width: 50%;
  float: left;
`

const Cell = styled.div`
  margin: 10px 0;
  background: ${theme.contentBackground};
  width: 95%;
  border: 1px solid ${theme.secondaryBackground};
  text-align: left;
  margin: 10px 20px;
  padding: 10px 20px;
`

const CollateralTitle = styled.h1`
  margin: 20px;
  font-weight: 600;
  display: flex;
  justify-content: normal;
`

const TableContainer = styled.div`
  width: 100%;
  overflow:hidden;
`
