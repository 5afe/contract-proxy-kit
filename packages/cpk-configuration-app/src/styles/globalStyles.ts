import avertaBoldFont from '@gnosis.pm/safe-react-components/dist/fonts/averta-bold.woff2'
import avertaFont from '@gnosis.pm/safe-react-components/dist/fonts/averta-normal.woff2'
import { createGlobalStyle } from 'styled-components'

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  body {
    padding: 10px;
  }

  @font-face {
    font-family: 'Averta';
    font-display: swap;
    src: local('Averta'), local('Averta Bold'),
    url(${avertaFont}) format('woff2'),
    url(${avertaBoldFont}) format('woff');
  }

  h4 {
    color: #008c73;
    margin: 20px 0 10px 0  !important;
  }
`

export default GlobalStyle
