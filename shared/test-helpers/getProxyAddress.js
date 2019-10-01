module.exports = receipt => {
  return receipt.logs.filter(l => l.event === 'NewAppProxy')[0].args.proxy
}
