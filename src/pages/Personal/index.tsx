import React, { Component, lazy, Suspense } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { LoadDiv } from 'ming-ui';
import { navigateTo } from 'src/router/navigateTo';
import { getRequest } from 'src/utils/common';
import common from './common.js';
import { routerConfigs } from './routerConfig.js';
import './index.less';

const guideSettings = md.global.Account.guideSettings;
const showWarn = guideSettings.accountEmail || guideSettings.accountMobilePhone;

/**
 * 【lazy() 不能在渲染期调】原来 render 里直接写 `const MainComponent = lazy(currentComp)`。
 *
 * v4 下这么写没事，v7 下是死循环：v7 的导航包在 React.startTransition 里，
 * 而 lazy() 每调一次都产出一个全新的组件类型、必然先 suspend。
 * 下面那个 <Suspense> 是【已经挂载过】的边界，transition 期间 React 不会把它
 * 换成 fallback，而是保留旧内容等新树就绪 —— 等 promise resolve 后重渲染本组件，
 * 又造一个新 lazy、又 suspend，就这么一直转下去，永不 commit。
 *
 * 症状：/personal?type=information 切到 ?type=enterprise，地址栏变了、
 * 左侧选中项和右侧内容纹丝不动。不抛错、不刷 CPU，只在第一轮发一次 chunk 请求
 * （webpack 之后命中缓存），所以看起来像「点了没反应」。
 * 整页刷新反而正常 —— 首次挂载不是 transition，边界可以直接显示 fallback 再 commit。
 *
 * 按工厂函数缓存即可：同一个 type 永远拿到同一个 lazy 组件。
 */
const lazyCache = new Map();
const getLazyComponent = factory => {
  if (!lazyCache.has(factory)) lazyCache.set(factory, lazy(factory));

  return lazyCache.get(factory);
};
export default class PersonalEntrypoint extends Component<any, any> {
  componentDidMount() {
    $('html').addClass('AppPersonal');
  }

  componentWillUnmount() {
    $('html').removeClass('AppPersonal');
  }

  shouldComponentUpdate(nextProps) {
    if (nextProps.location.search !== this.props.location.search) {
      return true;
    }

    return false;
  }

  handleClick(type) {
    const defaultType = type[0];
    navigateTo(
      common.url({
        type: defaultType,
      }),
    );
  }

  render() {
    const menus =
      (!window.platformENV.isOverseas && !window.platformENV.isLocal) ||
      ((window.platformENV.isOverseas || window.platformENV.isLocal) && md.global.Config.ShowLicense)
        ? routerConfigs
        : routerConfigs.filter(item => !item.typetag.includes('privatekey'));
    const type = getRequest().type || 'information';

    const currentComp = _.get(
      _.find(menus, menu => menu.typetag.includes(type)),
      'component',
    );

    const MainComponent = getLazyComponent(currentComp);
    return (
      <div className="mainBoxAccount">
        <div className="h100 bgPrimary accountTabWrap">
          <ul className="accountTab">
            {menus &&
              menus.map((item, index) => {
                return (
                  <li
                    className={cx('hoverBgTertiary Hand Relative', {
                      active: item.typetag.includes(type),
                    })}
                    key={index}
                    onClick={() => this.handleClick(item.typetag)}
                  >
                    <span className={cx('Font20 pRight15 textTertiary', item.icon)} />
                    {item.title}
                    {item.typetag.includes('account') && showWarn && type !== 'account' && (
                      <span className="warnLight warnLightMyaccount" />
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
        <div id="accountCenterMainBox" className="mainPage flex">
          <Suspense fallback={<LoadDiv className="mTop10" />}>
            <MainComponent />
          </Suspense>
        </div>
      </div>
    );
  }
}
