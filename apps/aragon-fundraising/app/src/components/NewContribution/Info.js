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
      <p>If the presale campaign fails you will be able to get refunded. If the presale campaign succeeds your shares will be vested.</p>
    </div>
  )
}

export default Info
