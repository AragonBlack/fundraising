import styled from 'styled-components'
import { Box, theme } from '@aragon/ui'

const grey = 'rgb(204, 204, 204)'

export default styled(Box)`
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  font-family: aragon-ui, sans-serif;
  & > div {
    width: 100%;
    }
  }

  /** Plotly chart **/
  .rangeslider-slidebox {
    fill: ${theme.accent};
    stroke: none;
    fill-opacity: 0.2;
  }

  .rangeslider-handle-min,
  .rangeslider-handle-max {
    fill: ${grey};
    stroke: none;
    fill-opacity: 0.7;
  }

  .rangeslider-mask-min,
  .rangeslider-mask-max,
  .xgrid {
    fill: none !important;
    stroke: none !important;
  }

  .ygrid {
    stroke: ${grey};
    stroke-dasharray: 10 5;
  }

  .yzl {
    stroke: ${grey} !important;
  }

  .yaxislayer-above {
    transform: translate(-10px, 0);
  }

  .ytick,
  .xtick {
    text {
      font-family: aragon-ui, sans-serif !important;
      font-size: 13px;
    }
  }

  .zoombox {
    fill: ${theme.accent} !important;
    stroke: none !important;
    fill-opacity: 0.2 !important;
  }

  .zoombox-corners {
    fill: ${grey} !important;
    stroke: none !important;
    fill-opacity: 0.7 !important;
  }

  .xy {
    & > rect {
      display: none;
      &.nsewdrag {
        display: inline;
      }
    }
  }
`
