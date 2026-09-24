import { Component } from 'react';
import _ from 'lodash';
import { string } from 'prop-types';
import ReactDocumentTitle from 'ming-ui/components/DocumentTitle';

const MAX_RETRY_TIMES = 20;
const RETRY_INTERVAL = 300;
let titleTimer: NodeJS.Timeout | undefined;
let latestTitle = '';

export function setDingTalkNavigationTitle(title: string) {
  const nextTitle = title ? `${title}` : '';

  if (!window.isDingTalk || !nextTitle) {
    return;
  }

  latestTitle = nextTitle;
  clearTimeout(titleTimer);

  const updateTitle = retryTimes => {
    if (latestTitle !== nextTitle) {
      return;
    }

    const navigation = _.get(window, 'dd.biz.navigation');

    if (_.isFunction(navigation && navigation.setTitle)) {
      try {
        navigation.setTitle({
          title: nextTitle,
        });
        return;
      } catch (err) {
        if (err && retryTimes >= MAX_RETRY_TIMES) {
          return;
        }
      }
    }

    // loadSDK 只是异步注入钉钉 SDK，不会阻塞页面渲染。
    // DocumentTitle 可能先于 window.dd.biz.navigation.setTitle 初始化完成；
    // 这里仅在钉钉环境短时间重试，等 JSAPI 可用后补设导航栏标题。
    if (retryTimes < MAX_RETRY_TIMES) {
      titleTimer = setTimeout(() => updateTitle(retryTimes + 1), RETRY_INTERVAL);
    }
  };

  updateTitle(0);
}

export interface DocumentTitleProps {
  title: string;
}

export default class DocumentTitle extends Component<DocumentTitleProps, any> {
  static override propTypes = {
    title: string,
  };

  override componentDidMount() {
    setDingTalkNavigationTitle(this.props.title);
  }

  override componentDidUpdate(prevProps: DocumentTitleProps) {
    if (prevProps.title !== this.props.title) {
      setDingTalkNavigationTitle(this.props.title);
    }
  }

  override componentWillUnmount() {
    setTimeout(() => {
      setDingTalkNavigationTitle(document.title);
    });
  }

  override render() {
    return <ReactDocumentTitle title={this.props.title} />;
  }
}
