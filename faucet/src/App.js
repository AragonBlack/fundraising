import React, { Component } from "react";
import { Main, Button } from "@aragon/ui";
import contract from "truffle-contract";
import BigNumber from "big-number";
import testTokens from "@aragon/templates-tokens";
import TokenFactoryABI from "./abis/TokenFactory.json";

const TokenFactory = contract(TokenFactoryABI);
const ANT = testTokens.rinkeby.tokens[0];
const DAI = testTokens.rinkeby.tokens[9];

const style = {
  fontFamily: "'Roboto Mono', monospace",
  fontWeight: "lighter"
};

class App extends Component {
  constructor() {
    super();
    this.state = {
      network: undefined,
      account: undefined,
      factory: undefined
    };
  }

  mint(token) {
    const amount = new BigNumber("10000000000000000000000");
    console.log("Requesting 10000 " + token);

    if (token === "DAI") {
      this.state.factory.mint(DAI, this.state.account, amount, {
        from: this.state.account
      });
    }
    if (token === "ANT") {
      this.state.factory.mint(ANT, this.state.account, amount, {
        from: this.state.account
      });
    }
  }

  componentDidMount() {
    if (typeof window.ethereum !== "undefined") {
      window.ethereum
        .enable()
        .then(_ => {
          this.setState({ network: window.ethereum.networkVersion });
          this.setState({ account: window.ethereum.selectedAddress });

          if (window.ethereum.networkVersion === "4") {
            TokenFactory.setProvider(window.ethereum);
            TokenFactory.at(testTokens.rinkeby.factory)
              .then(factory => {
                this.setState({ factory });
              })
              .catch(err => {
                console.error(err);
              });
          }
        })
        .catch(err => {
          console.error(err);
        });
    }
  }

  render() {
    const { network, account, factory } = this.state;

    if (typeof window.ethereum === "undefined" || this.state.network !== "4") {
      return (
        <div id="#error">
          please connect Metamask to the Rinkeby network [reload] and enable our
          app
        </div>
      );
    } else {
      return (
        <div id="#app">
          <div id="buttons">
            <div>
              <Button
                style={style}
                mode="strong"
                onClick={() => this.mint("DAI")}
              >
                Request Aragon Rinkeby DAI
              </Button>
              <p>{DAI}</p>
            </div>
            <div>
              <Button
                style={style}
                mode="strong"
                onClick={() => this.mint("ANT")}
              >
                Request Aragon Rinkeby ANT
              </Button>
              <p>{ANT}</p>
            </div>
          </div>
        </div>
      );
    }
  }
}

export default App;
