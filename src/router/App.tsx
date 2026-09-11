import React, { Component, Fragment } from 'react';
import { Route, Routes } from 'react-router';
import { Popover } from 'antd';
import _ from 'lodash';
import { Dialog, Icon } from 'ming-ui';
import ErrorBoundary from 'ming-ui/components/ErrorBoundary';
import privateGuide from 'src/api/privateGuide';
import preall from 'src/common/preall';
import ChatList from 'src/pages/chat/containers/ChatList';
import ChatPanel from 'src/pages/chat/containers/ChatPanel';
import { ROUTE_CONFIG_PORTAL } from 'src/pages/Portal/config';
import PortalPageHeaderRoute from 'src/pages/Portal/PageHeader';
import { getAppFeaturesVisible } from 'src/utils/common';
import socketInit from '../socket';
import { ROUTE_CONFIG, withoutChatUrl } from './config';
import genRouteComponent from './genRouteComponent';
import globalEvents from './globalEvents';
import weixinCode from './images/supportQrCode.png';
import NotFoundRedirect from './NotFoundRedirect';
import PageHeaderRoute from './PageHeader';
import withRouter from './withRouter';
import './index.less';

class App extends Component<any, any> {
  constructor(props) {
    super(props);

    this.state = {
      isSupport: true,
      supportTime: '',
    };

    window.reactRouterHistory = props.history;
    this.genRouteComponent = genRouteComponent();
    !window.isPublicApp && socketInit();
  }

  componentDidMount() {
    // 全局注入事件
    globalEvents();

    if ((_.get(md, ['global', 'Account', 'projects']) || []).filter(item => item.licenseType === 1).length === 0) {
      if (!localStorage.getItem('supportTime')) {
        privateGuide.getSupportInfo().then(result => {
          if (!result.isSupport && result.supportTime) {
            this.setState({ isSupport: result.isSupport, supportTime: result.supportTime });
          }
        });
      }
    } else {
      localStorage.removeItem('supportTime');
    }
  }

  /**
   * 验证升级
   */
  checkUpgrade() {
    const { isSupport, supportTime } = this.state;

    if (isSupport || localStorage.getItem('supportTime')) return null;

    return (
      <Dialog
        title={<span className="Red Bold">{_l('升级受限提醒')}</span>}
        width="630"
        closable={false}
        visible
        showCancel={false}
        okText={_l('我已知晓')}
        onOk={() => {
          this.setState({ isSupport: true });
          localStorage.setItem('supportTime', supportTime);
        }}
      >
        <div className="LineHeight25">
          <span className="Gray_9e">
            {_l(
              '由于当前系统绑定的密钥技术支持时间已到期（%0 到期），无法升级到 %1 版本（发布时间早于到期时间的版本可升级），现已自动降为免费版，',
              supportTime,
              md.global.Config.Version,
            )}
          </span>
          {md.global.Account.superAdmin ? (
            <Fragment>
              <span className="Gray_9e">{_l('您可以')}</span>
              {/* 上游写的是 arrow={true}，但那是 antd 5+ 的 prop —— antd 4 的 Popover 本来就带箭头，
                  这个 prop 在 4 里是无效属性（上游不跑 tsc 所以没发现）。去掉，运行时行为完全一致。
                  等 antd 升到 5/6 之后可以按需加回来。 */}
              <Popover content={<img style={{ width: 300 }} src={weixinCode} />} placement="bottom">
                <span
                  style={{
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    color: '#47B14B',
                    padding: '2px 10px',
                  }}
                >
                  <Icon icon="weixin" className="mRight2" />
                  {_l('提交工单')}
                </span>
              </Popover>
              <span className="Gray_9e">{_l('咨询并延长技术支持或查看')}</span>
              <a href="https://docs-pd.mingdao.com/version" target="_blank" className="mLeft3">
                {_l('其他可升级的版本')}
              </a>
            </Fragment>
          ) : (
            <span className="Gray_9e">{_l('请尽快联系系统管理员')}</span>
          )}
        </div>
      </Dialog>
    );
  }

  render() {
    const { rp, ch } = getAppFeaturesVisible();

    if (md.global.Account.isPortal) {
      return (
        <div id="wrapper" className="flexColumn">
          <div className="flexColumn flex" id="containerWrapper">
            <PortalPageHeaderRoute />
            <section id="container">
              <Routes>{this.genRouteComponent(ROUTE_CONFIG_PORTAL)}</Routes>
            </section>
          </div>
        </div>
      );
    }

    return (
      <div id="wrapper" className="flexRow">
        <div className="flexColumn flex" id="containerWrapper">
          <PageHeaderRoute />
          <section id="container">
            <Routes>
              {this.genRouteComponent(ROUTE_CONFIG)}
              {/* v7 里 * 的排序恒定最低，与 v4 把兜底放在 <Switch> 最后是同一个效果 */}
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </section>
        </div>
        <section id="chatPanel">{rp && <ChatPanel />}</section>

        {this.checkUpgrade()}

        {ch && (
          <section id="chat">
            {/* 原来这里用一条 path={withoutChatUrl} 的空路由把「不显示聊天」的
                URL 占掉、其余落到 path="*" 上。withoutChatUrl 现在是谓词函数
                （见 config.ts 里的说明），直接判断即可。 */}
            {/* App 外层套了 withRouter，导航时会拿到新的 location prop 并重渲染，
                所以这里读 props.location.pathname 而不是全局 location —— 后者
                在 SPA 里不会触发 React 更新。 */}
            {!window.isPublicApp && rp && !withoutChatUrl(this.props.location.pathname) && <ChatList />}
          </section>
        )}
      </div>
    );
  }
}

export default preall(ErrorBoundary.wrap(withRouter(App), true));
