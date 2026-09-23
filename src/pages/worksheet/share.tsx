import React, { Component } from 'react';
import WorksheetShareLand from './pages/WorksheetShareLand';

export default class WorksheetShareLandEntry extends Component<any, any> {
  override componentDidMount() {
    $('html').addClass('WorksheetShareApp');
  }
  override componentWillUnmount() {
    $('html').removeClass('WorksheetShareApp');
  }
  override render() {
    return <WorksheetShareLand worksheetId={this.props.match.params.id} />;
  }
}
