import React from 'react'

export default ({ label: { first, second }, index, active, onClick }) => {
  return (
    <div className={active ? 'item active' : 'item'} onClick={() => onClick(index)}>
      <span>{first}</span>
      {second ? <span>{second}</span> : null}
    </div>
  )
}
