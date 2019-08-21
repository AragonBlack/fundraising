import React from 'react'

const Info = ({ isBuyOrder }) => {
  return (
    <div
      css={`
        background-color: #f1fbff;
        border-radius: 4px;
        color: #188aaf;
        padding: 1rem;
        margin-top: 2rem;
        border-left: 2px solid #0ab0e5;
      `}
    >
      <p css="font-weight: 700;">Info</p>
      <p>
        For a {isBuyOrder ? 'buying' : 'selling'} order, the more collateral is staked into the bonding curve, you may opt to sell a small share of your tokens
        in order to redeem collateral from the contract and fund the development of the project.
      </p>
    </div>
  )
}

export default Info
