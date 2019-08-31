<h1 align="center">
 <img src="./.github/images/icon.svg" alt="Aragon Fundraising" width="200">
  <br>
  Aragon Fundraising
  <br>
</h1>

<h4 align="center">
    A continuous fundraising apps suite for <a href="https://www.aragon.org" target="_blank">Aragon</a> organizations.
</h4>

<p align="center">
  <a href="https://badge.fury.io/js/electron-markdownify">
    <img
        src="https://travis-ci.org/AragonBlack/fundraising.svg?branch=next"
        alt="Build"
    >
  </a>
  <a href="https://www.gnu.org/licenses/agpl-3.0">
    <img
        src="https://img.shields.io/badge/License-AGPL%20v3-blue.svg"
        alt="License"
    >
  </a>
  <a href="https://en.cryptobadges.io/donate/0x233373130f7d859c1d743d01b7dfa09b9667a69a">
    <img
        src="https://en.cryptobadges.io/badge/micro/0x233373130f7d859c1d743d01b7dfa09b9667a69a"
        alt="Donate"
    >
  </a>
  <a href="https://twitter.com/AragonBlackTeam">
    <img 
        src="https://img.shields.io/twitter/follow/AragonBlackTeam?label=Follow"
        alt="Follow"
    >
  </a>
</p>

## Architecture

![Architecture](.github/images/architecture.svg)


## Packages


### NPM Packages

| Package                                                                                | Version | Description                                                                                          |
| -------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| [`@ablack/fundraising-bancor-formula`](/apps/bancor-formula)                           |         | `BancorFormula` computation contract                                                                 |
| [`@ablack/fundraising-batched-bancor-market-maker`](/apps/batched-bancor-market-maker) |         | Automated market-maker batching orders filled through the `BancorFormula`                            |
| [`@ablack/fundraising-tap`](/apps/tap)                                                 |         | Control the flow of funds from a reserve to a beneficiary                                            |
| [`@ablack/fundraising-aragon-fundraising`](/apps/aragon-fundraising)                   |         | `API` providing a single entry-point to interact consistently with all fundraising-related contracts |



