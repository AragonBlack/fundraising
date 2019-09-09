const sha3 = require('js-sha3').keccak_256

module.exports = assertExternalEvent = (tx, eventName, instances = 1) => {
  const events = tx.receipt.logs.filter(l => {
    return l.topics[0] === '0x' + sha3(eventName)
  })
  assert.equal(events.length, instances, `'${eventName}' event should have been fired ${instances} times`)
  return events
}
