import React from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Main, observe } from "@aragon/ui";
import AppLayout from "./components/AppLayout";
import Aragon, { providers } from "@aragon/client";

class App extends React.Component {
  static defaultProps = {};

  constructor(props) {
    super(props);

    this.state = {};
  }

  handleMenuPanelOpen = () => {
    // this.props.sendMessageToWrapper('menuPanel', true)
  };

  render() {
    const { branches } = this.props;

    return (
      <div css="min-width: 320px">
        <Main>
          <AppLayout title="BondingCurve" onMenuOpen={this.handleMenuPanelOpen} />
        </Main>
      </div>
    );
  }
}

export default observe(
  observable =>
    observable.map(state => {
      return {
        ...state
      };
    }),
  {}
)(App);
