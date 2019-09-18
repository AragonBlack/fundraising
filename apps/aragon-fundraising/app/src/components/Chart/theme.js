import { theme } from '@aragon/ui'

// Colors
const blue = 'rgb(8, 190, 229)'
const grey = 'rgb(204, 204, 204)'
const darkGrey = 'rgb(33, 43, 54)'

// Labels
const baseLabelStyles = {
  fontFamily: 'aragon-ui, sans-serif',
  fontSize: 12,
  letterSpacing: 'normal',
  fill: darkGrey,
  stroke: 'none',
  strokeWidth: 0,
}

export const none = { fill: 'none', stroke: 'none' }

export const brushStyle = { fill: theme.accent, stroke: 'none', fillOpacity: 0.2 }

export const handleStyle = { fill: grey, stroke: 'none', fillOpacity: 0.7 }

// Victory fundraising theme
export default {
  area: {
    style: {
      data: {
        fill: '#fff',
      },
    },
  },
  independentAxis: {
    style: { grid: none },
  },
  axis: {
    style: {
      axis: none,
      axisLabel: { ...baseLabelStyles, padding: 38 },
      grid: {
        fill: 'none',
        stroke: grey,
        strokeDasharray: '10, 5',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        pointerEvents: 'painted',
      },
      ticks: none,
      tickLabels: { ...baseLabelStyles, padding: 8 },
    },
  },
  bar: {
    style: {
      data: {
        fill: theme.accent,
        stroke: 'none',
      },
      labels: baseLabelStyles,
    },
  },
  candlestick: {
    style: {
      data: {
        stroke: darkGrey,
      },
    },
    candleColors: {
      positive: theme.positive,
      negative: theme.negative,
    },
    wickStrokeWidth: 2,
  },
  line: {
    style: {
      data: {
        fill: 'none',
        opacity: 1,
        stroke: theme.accent,
        strokeWidth: 2,
      },
    },
  },
}
