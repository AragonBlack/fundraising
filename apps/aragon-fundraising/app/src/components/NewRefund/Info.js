import React from 'react'

const Info = () => {
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
        The presale did not reach its goal. You can thus request for your contributions to get refunded. If you have made multiple contributions, you should
        request to get refunded for each of them.
      </p>
    </div>
  )
}

export default Info
