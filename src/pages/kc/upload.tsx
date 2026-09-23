import { Component } from 'react';
import UploadAssistant from './common/UploadAssistant';
import './main.css';

// 隐藏 chat、mobileShare

export default class KcUploadEntrypoint extends Component<any, any> {
  override componentDidMount() {
    $('html').addClass('AppKc AppKcUpload');
  }
  override componentWillUnmount() {
    $('html').removeClass('AppKc AppKcUpload');
  }
  override render() {
    return <UploadAssistant />;
  }
}
