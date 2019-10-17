import { GU } from '@aragon/ui'

export const layout = range => ({
  dragmode: 'zoom',
  margin: {
    r: 50,
    t: 0,
    b: 0,
    l: 50,
  },
  showlegend: false,
  xaxis: {
    autorange: true,
    range,
    rangeslider: { range },
    type: 'date',
  },
  yaxis: {
    autorange: true,
  },
})

export const config = {
  displayModeBar: false,
  responsive: true,
}

export const style = `
  margin-top: ${3 * GU}px;
  width: 100%;
  height: 450px;
`
