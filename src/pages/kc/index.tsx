import React, { Component } from 'react';
import withRouter from '../../router/withRouter';
import qs from 'query-string';
import KcLeft from './common/KcLeft';
import KcMain from './common/KcMain';
import './Kc.less';

let KcEntrypoint = class KcEntrypoint extends Component<any, any> {
  componentDidMount() {
    $('html').addClass('AppKc');
  }

  componentWillUnmount() {
    $('html').removeClass('AppKc');
  }

  render() {
    const {
      match: { params },
    } = this.props;
    // 路由是 '/apps/kc/*'（见 src/router/config.ts），是个 splat。
    // react-router 7 把通配段放进 params['*']，【没有】params.path —— 实测
    // params 就是 { "*": "my" }。这是 v4 → v7 迁移漏掉的一处：另外三个 splat
    // 路由当时都补了等价处理（integration/index.tsx 与 plugin/index.tsx 重建
    // match.params，Admin 改用 getProjectIdFromPath），只有知识中心没补。
    //
    // 症状不是报错，是【永久转圈】，很难往路由上想：
    // path 为 undefined → KcMain.componentDidMount 走 navigateTo(baseUrl+'/my')，
    // 而地址本来就是 /apps/kc/my，于是这步是空转、changeFolder 永不执行 →
    // kc.path 停在初始的 ''  → getRootByPath('') 三个正则都不匹配、返回 {} →
    // getNodes({ parentId: undefined, rootType: undefined }) → 后端回
    // 「参数错误」。该拒绝没有 .catch，以 unhandledrejection 静默丢掉，
    // 控制台连红字都没有，只剩一个 MdLoader 一直转。
    const path = params['*'];
    return (
      <div className="kc flexRow">
        <KcLeft path={path} query={qs.parse((location.search || '').slice(1))} />
        <KcMain appBaseUrl="/apps/kc" path={path} query={qs.parse((location.search || '').slice(1))} />
      </div>
    );
  }
};
KcEntrypoint = withRouter(KcEntrypoint);
export default KcEntrypoint;
