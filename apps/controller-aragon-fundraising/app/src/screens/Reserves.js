import React, { useEffect, useState } from 'react'
import { Badge, Button, Card, Form, Field, Table, TableRow, TableCell, Text, TextInput } from '@aragon/ui'
import styled from 'styled-components'

export default () => {
  const [state, setState] = useState({
    transferable: false,
    monthlyAllocation: 1000,
    totalSupply: 15000.456,
    antRatio: 60,
    daiRatio: 40
  })

  const { transferable, monthlyAllocation, totalSupply, antRatio, daiRatio } = state
  return (
    <ContentWrapper>
      <Card width={"auto"}>
        <h1 className="title">
          <Text>Edit reserve settings</Text>
        </h1>
        <Table width={"400"} >
          <TableRow>
            <Field title="Monthly allocation">
              <TextInput
                adornment={"DAI"}
                adornmentPosition={"end"}
                value={monthlyAllocation}
                required
                wide
              />
            </Field>
          </TableRow>
          <TableRow>
            <Button type="submit">Edit monthly allocation</Button>
          </TableRow>
        </Table>
        <div>
          <Field title="ANT collateralization ratio">
            {antRatio}%
          </Field>
          <Field title="DAI collateralization ratio">
            {daiRatio}%
          </Field>
        </div>
      </Card>
      <Card width={"auto"}>
        <CardHeader>
          <Text smallcaps >Monthly Allowance</Text>
        </CardHeader>
        <Table noSideBorders >
          <TableRow>
            <TableCell>
              <Text>Total Supply</Text>
            </TableCell>
            <TableCell>
              <Text>{totalSupply}</Text>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Text>Transferable</Text>
            </TableCell>
            <TableCell>
              <Text>{transferable ? 'YES' : 'NO'}</Text>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Text>Token</Text>
            </TableCell>
            <TableCell>
              <Badge>Ethical (ETH)</Badge>
            </TableCell>
          </TableRow>
        </Table>
      </Card>
    </ContentWrapper>
  )
}

const ContentWrapper = styled.div`
  padding: 2rem;
  display:flex;

  > div {
    float:left;
    height: fit-content;
  }

  > div:first-child {
    padding: 2rem;
  }

  @media only screen and (max-width: 700px) {
    padding: 0;
  }
`

const CardHeader = styled.div`
  width: 100%;
  height: auto;
  border-bottom: 1px solid rgba(209, 209, 209, 0.5);
`
