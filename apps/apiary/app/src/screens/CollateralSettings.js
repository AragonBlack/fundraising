import { Title, theme, Button, Badge, Table, TableCell, TableHeader, TableRow, Text, DropDown } from '@aragon/ui';
import AddCollateralSidePanel from '../components/AddCollateralSidePanel'
import React from 'react';
import styled from 'styled-components'

const tapRateIntervals = ['Monthly', 'Quarterly', 'Yearly']

export default class CollateralSettings extends React.Component  {
    static defaultProps = {
        appToken: 'ATL'
    }
    constructor(props) {
        super(props)
        this.handleCollateralSidePanelOpen = this.handleCollateralSidePanelOpen.bind(this)
        this.handleCollateralSidePanelClose = this.handleCollateralSidePanelClose.bind(this)
        this.handleTapRateChange = this.handleTapRateChange.bind(this)
        this.state = {
            activeItem: 0,
            tapRateInterval: tapRateIntervals[0],
	    newTapRate: 0,
	    newCollateralRatio: 0,
	    newTokenAddress: '',
            updateCollateralSidePanelOpen: false
        }
    }
    handleCollateralSidePanelOpen() {
        this.setState({ updateCollateralSidePanelOpen: true })
    }
    handleCollateralSidePanelClose() {
        this.setState({ updateCollateralSidePanelOpen: false })
    }
    handleTapRateChange(index) {
        const tapRate = tapRateInterval[index];
        this.setState({ activeItem: index })
    }
    handleUpdateCollateralSettings(tokenAddress, collateralRatio, tapRate) {
      //this.props.app.addToken(tokenAddress, collateralRatio, tapRate)
    }
    render() {
        const { appToken } = this.props
        const { activeItem, updateCollateralSidePanelOpen, newTokenAddress, newCollateralRatio, newTapRate } = this.state
        const tableRowStyle = { height: '2rem' }
        return (
            <div>
                <CollateralTitle>
                    <Text>Collateralize and generate</Text>
                    <Badge style={{ marginLeft: '10px'}}>{appToken}</Badge>
                </CollateralTitle>
                <TableContainer>
                  <Table header={
                      <TableRow>
                          <TableHeader title="Collateral Ratio" />
                          <TableHeader title="Token" />
                      </TableRow>
                  } style={{ float: 'left', width: '65%' }}>
                    <TableRow>
                        <TableCell>
                            <Text>0.00</Text>
                        </TableCell>
                        <TableCell>
                            <Text>ETH</Text>
                        </TableCell>
                    </TableRow>
                    <Button style={{ marginTop: '2rem' }}>Add Collateral Token</Button>
                  </Table>
                  <Table noSideBorders={true} style={{ padding: '1rem', float: 'left', width: '35%'}}>
                      <TableRow style={tableRowStyle}>
                          <Text>Bonding Curve Supply</Text>
                      </TableRow>
                      <TableRow style={tableRowStyle}>
                          <Text color={theme.textSecondary}>Collateral Ratio</Text>
                          <Text style={{ float: 'right' }}>$199,333.88</Text>
                      </TableRow>
                      <TableRow style={tableRowStyle}>
                          <Text color={theme.textSecondary}>Tap rate (per month)</Text>
                          <Text style={{ float: 'right' }}>$9,222.81</Text>
                      </TableRow>
                      <hr style={{ color: theme.contentBorderActive }}/>
                      <TableRow style={tableRowStyle}>
                          <Text color={theme.textSecondary}>Total</Text>
                          <Text style={{ float: 'right' }}>$33,333.88</Text>
                      </TableRow>
                      <TableRow style={tableRowStyle}>
                          <Text color={theme.textSecondary}>Token gains</Text>
                          <Text style={{ float: 'right' }}>$103,211,689.44</Text>
                      </TableRow>
                      <TableRow style={{ height: '16rem' }}>
                          <Text color={theme.textSecondary} style={{ marginRight: '1rem'}}>Tap</Text>
                          <DropDown items={tapRateIntervals} active={activeItem} onChange={this.handleTapRateChange}/>
                      </TableRow>
                  </Table>
                </TableContainer>
		<AddCollateralSidePanel
		    tokenAddress={newTokenAddress}
		    collateralRatio={newCollateralRatio}
		    tapRate={newTapRate}
		    opened={updateCollateralSidePanelOpen}
		    onClose={this.handleCollateralSidePanelClose}
		    onSubmit={this.handleUpdateOrder}
		  />
            </div>
        )
    }
}

const CollateralTitle = styled.h1`
  margin: 20px 0;
  font-weight: 600;
  display: flex;
  justify-content: normal;
`

const TableContainer = styled.div`
  width: 100%;
  overflow:hidden;
`
