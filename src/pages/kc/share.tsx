import { Component } from 'react';
import NodeShare from './common/NodeShare';
import './main.css';

export default class KcShareEntrypoint extends Component<any, any> {
  override componentDidMount() {
    $('html').addClass('AppKc AppKcShare');
  }
  override componentWillUnmount() {
    $('html').removeClass('AppKc AppKcShare');
  }
  override render() {
    return <NodeShare />;
  }
}
