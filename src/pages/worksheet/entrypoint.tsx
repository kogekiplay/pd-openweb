import { Component } from 'react';
import WorkSheet from './WorkSheet';

export default class KcEntrypoint extends Component<any, any> {
  override componentDidMount() {
    $('html').addClass('AppWorkSheet');
  }
  override componentWillUnmount() {
    $('html').removeClass('AppWorkSheet');
  }
  override render() {
    return <WorkSheet />;
  }
}
