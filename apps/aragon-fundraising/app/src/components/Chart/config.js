export const trace = (x, y) => ({
  type: 'scatter',
  mode: 'lines',
  line: { color: '#00CBE6' },
  x,
  y,
})

export const layout = range => ({
  xaxis: {
    autorange: true,
    range,
    rangeslider: { range },
    type: 'date',
  },
  yaxis: {
    autorange: true,
    rangemode: 'tozero',
    type: 'linear',
  },
  font: {
    family: 'aragon-ui, sans-serif',
    size: 16,
    color: 'rgb(33, 43, 54)',
  },
})

export const config = {
  displayModeBar: false,
}
