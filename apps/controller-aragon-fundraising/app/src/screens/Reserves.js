import React, { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Form, Field, Table, TableRow, TableCell, Text, TextInput, theme } from '@aragon/ui'
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
  const inputRef = useRef(monthlyAllocation)

  const handleMonthlyChange = event => {
    setState({...state, monthlyAllocation: event.target.value })
  }
  const onButtonClick = () => {
    const updatedAllocation = inputRef.current.value;
    // call contract api to update if they have valid permissions
  };

  return (
    <ContentWrapper>
      <Card style={{ minWidth: '500px' }} width={"50%"}>
        <h1 className="title">
          <Text>Edit reserve settings</Text>
        </h1>
        <Table style={{ width: '50%', float: 'left', marginRight: '2rem' }}>
          <TableRow>
            <Field
              css={inputCss}
              label={NotificationLabel("Monthly allocation")}>
              <TextInput
                ref={inputRef}
                adornment={<Text as="p" style={{ paddingRight: '12px' }}>DAI</Text>}
                adornmentPosition={"end"}
                value={monthlyAllocation}
                onChange={handleMonthlyChange}
                required
              />
            </Field>
          </TableRow>
          <TableRow>
            <Button type="submit" onSubmit={onButtonClick}>Edit monthly allocation</Button>
          </TableRow>
        </Table>
        <div>
          <Field label={NotificationLabel("ANT collateralization ratio")}>
            <Text>{antRatio}%</Text>
          </Field>
          <Field label={NotificationLabel("DAI collateralization ratio")}>
            <Text>{daiRatio}%</Text>
          </Field>
        </div>
      </Card>
      <Card width={"20%"}>
        <CardHeader>
          <Text
            color={theme.textSecondary}
            size="xlarge"
            smallcaps
            as="p"
            style={{ padding: '5px 20px' }}
          >
            Monthly Allowance
          </Text>
        </CardHeader>
        <Table css={borderlessTableCss} noSideBorders >
          <TableRow>
            <TableCell>
              <Text color={theme.textSecondary}>Total Supply</Text>
            </TableCell>
            <TableCell>
              <Text>{totalSupply}</Text>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Text color={theme.textSecondary}>Transferable</Text>
            </TableCell>
            <TableCell>
              <Text>{transferable ? 'YES' : 'NO'}</Text>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Text color={theme.textSecondary}>Token</Text>
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

const styles = {
  notification: {
    margin: '0 10px',
    cursor: 'pointer'
  }
}

const NotificationLabel = (label) => (
  <Text style={{ marginBottom: '10px'}}>
    {label}
    <Badge.Notification
      style={{ margin: '0 10px', cursor: 'pointer'}}
      background={theme.badgeAppForeground}
    >
      ?
    </Badge.Notification>
  </Text>
)

const ContentWrapper = styled.div`
  padding: 2rem;
  display:flex;

  h1 {
    margin-bottom: 1rem;
  }


  > div {
    float:left;
    height: fit-content;
  }

  > div:first-child {
    padding: 2rem;
  }

  > div:last-child {
    margin-left: 1.5rem;
    min-width: 260px;
  }

  @media only screen and (max-width: 700px) {
    padding: 0;
  }
`

const inputCss = `
  > label > div:last-child {
    width: 100%;
  }

  > label > div input {
    width: 100%;
  }
`

const borderlessTableCss = `
  tbody tr td {
    border: none;
    padding: 10px 20px;
  }
`

const CardHeader = styled.div`
  width: 100%;
  height: auto;
`
