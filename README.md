<h1 align="center">
<br>

 <img src="./.github/images/icon.svg" alt="Aragon Fundraising" width="200">
  <br>
  Aragon Fundraising
  <br>
  <br>
</h1>

<br>
<h4 align="center">
  Fundraising Apps Suite for <a href="https://www.aragon.org" target="_blank">Aragon</a> Organizations
</h4>

<p align="center">
  <a href="https://badge.fury.io/js/electron-markdownify">
    <img
      src="https://travis-ci.org/AragonBlack/fundraising.svg?branch=next"
      alt="Build"
    >
  </a>
  <a href="https://coveralls.io/github/AragonBlack/fundraising?branch=next">
    <img
      src="https://coveralls.io/repos/github/AragonBlack/fundraising/badge.svg?branch=next"
      alt="Coverage"
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
  <a href="https://aragon.chat">
    <img
      src="https://img.shields.io/badge/chat-Rocket.Chat-GREEN"
      alt="Chat"
    >
  </a>
  <a href="https://twitter.com/AragonBlackTeam">
    <img 
      src="https://img.shields.io/twitter/follow/AragonBlackTeam?label=Follow"
      alt="Follow"
    >
  </a>
</p>

<br>


## Disclaimer

Aragon Fundraising is an open source suite of apps. None of the people or institutions involved in its development may be held accountable for how it is used. If you do use it please make sure you comply to the jurisdictions you may be jubjected to.

## Overview

Aragon Fundraising is a suite of Aragon apps providing Aragon organizations continuous fundraising capabilities. It implements the following features.

### Presale

This module allows organizations to set a presale target that must be reached during a given period of time for the continous fundraising campaign to actually start.

### Automatic Batched Market Making

This module provides market liquidity to the fundraising campaign by automatically matching all the buy and sell orders according to a bonding curve tied to the Bancor formula. To mitigate front-running attacks and authorizing slow-trading this module also batches all the buy and sell orders received during a parametrable period of time to be matched given a common price.

### Tap

This module enforce a tap-based control of the funds allowed to be withdrawn from the market-maker reserve pool to a discretionnary pool whose funds can be spent to sustain the organization. To provide more guarantees to the investors this tap module also allows this flow of funds to be floored [thus ensuring that the market maker reserve pool can't be emptied even slowly during a long period of time].


## Architecture

![Architecture](.github/images/architecture.svg)


## Packages


### NPM Packages

| Package                                                                                | Version | Description                                                                                                   |
| -------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| [`@ablack/fundraising-bancor-formula`](/apps/bancor-formula)                           |         | `BancorFormula` computation contract                                                                          |
| [`@ablack/fundraising-batched-bancor-market-maker`](/apps/batched-bancor-market-maker) |         | Automated market-maker batching orders filled through the `BancorFormula`                                     |
| [`@ablack/fundraising-tap`](/apps/tap)                                                 |         | Tap controlling the flow of funds from a reserve to a beneficiary                                             |
| [`@ablack/fundraising-aragon-fundraising`](/apps/aragon-fundraising)                   |         | `API` contract providing a single entry-point to interact consistently with all fundraising-related contracts |


## Contributing

We are highly open to the community helping use improve and shape the future of `Aragon Fundraising`.

To learn more about our development and deployment workflows you can look into the [`Workflow.md`](/Workflow.md) file.
