import { Title, Button, Badge, Table, TableCell, TableHeader, TableRow, Text, DropDown } from '@aragon/ui';
import React from 'react';
import styled from 'styled-components'

const tapRateInterval = ['Monthly', 'Quarterly', 'Yearly']

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
            //tapRate: props.tapRate,
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
        const tapRate = collateralTokens[index];
        this.setState({ activeItem: index })
    }
    render() {
        const { appToken } = this.props
        const { activeItem } = this.state
        return (
            <div>
                <CollateralTitle>
                    <Text>Collateralize and generate</Text>
                    <Badge style={{ marginLeft: '10px'}}>{appToken}</Badge>
                </CollateralTitle>
                <Table header={
                    <TableRow>
                        <TableHeader title="Collateral Ratio" />
                        <TableHeader title="Token" />
                    </TableRow>
                }>
                    <TableRow>
                        <TableCell>
                            <Text>0.00</Text>
                        </TableCell>
                        <TableCell>
                            <Text>ETH</Text>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <Button>Add Collateral Token</Button>
                    </TableRow>
                    <Table noSideBorders={true}>
                        <TableRow>
                            <Text>Bonding Curve Supply</Text>
                            <Text>0.00</Text>
                            <Text>ETH</Text>
                        </TableRow>
                    </Table>    
                </Table>
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
