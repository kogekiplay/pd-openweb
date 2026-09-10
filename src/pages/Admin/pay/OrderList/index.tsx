import React, { Component } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import { Button, Icon } from 'ming-ui';
import { buriedUpgradeVersionDialog } from 'src/components/upgradeVersion';
import AdminTitle from 'src/pages/Admin/common/AdminTitle';
import { navigateTo } from 'src/router/navigateTo';
import { addSubPathOfRoute } from 'src/utils/common';
import { VersionProductType } from 'src/utils/enum';
import { getFeatureStatus } from 'src/utils/project';
import Config from '../../config';
import { TABS } from '../config';
import RefundOrder from './components/RefundOrder';
import TransactionDetails from './components/TransactionDetails';

const Comp = {
  transaction: TransactionDetails,
  refund: RefundOrder,
};

export default class Merchant extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      showHeader: true,
      disabledExportBtn: true,
    };
  }

  changeTab = key => {
    const projectId = Config.projectId;
    navigateTo(`/admin/${key}/${projectId}`);
  };

  render() {
    const { showHeader, disabledExportBtn } = this.state;
    const featureType = getFeatureStatus(Config.projectId, VersionProductType.PAY);
    // 与 systemSetting 同样的处理：当前 Tab 从路径派生，不再存 state。
    // 原来只在点击 changeTab 时 setState，浏览器【后退】时不会变
    //（v4 是靠内层 <Route> 重新匹配兜住的，那些路由现在留不住了）。
    const seg = location.pathname.split('/');
    const currentTab = seg[seg.indexOf('admin') + 1] || TABS[0].key;
    const ActiveComp = Comp[currentTab] || Comp[TABS[0].key];

    return (
      <div className="orgManagementWrap">
        <AdminTitle prefix={_l(`支付与开票 - ${(_.find(TABS, v => v.key === currentTab) || {}).label || '订单'}`)} />
        {showHeader && (
          <div className="orgManagementHeader">
            <div className="tabBox">
              {TABS.map(item => (
                <span
                  key={item.key}
                  className={cx('tabItem Hand', { active: currentTab === item.key })}
                  onClick={() => this.changeTab(item.key)}
                >
                  {item.label}
                </span>
              ))}
            </div>
            <div className="flexRow alignItemsCenter">
              <Icon
                icon="task-later"
                className="textTertiary hoverText Font17"
                onClick={() => {
                  if (this.com) {
                    if (currentTab === 'transaction') {
                      this.com.getDataList();
                      this.com.getPayOrderSummary();
                    } else {
                      this.com.getDataList();
                    }
                  }
                }}
              />
              <Button
                type="primary"
                className="export mLeft24"
                disabled={disabledExportBtn}
                onClick={() => {
                  if (featureType === '2') {
                    buriedUpgradeVersionDialog(Config.projectId, VersionProductType.PAY);
                    return;
                  }

                  if (this.com) {
                    this.com.handleExport();
                  }
                }}
              >
                {_l('导出')}
              </Button>
            </div>
          </div>
        )}
        <div
          className={cx('flexColumn overflowHidden', {
            orgManagementContent: showHeader,
            orgManagementWrap: !showHeader,
          })}
        >
          {/* 原来这里用 TABS.map 生成内层 <Route> 来决定渲染哪个 Tab。
              迁到 v7 后这些路由留不住：判别段（transaction / refund）已经被
              Admin 的子路由 'transaction/:projectId' / 'refund/:projectId' 消费掉，
              相对化之后几条会撞在一起。改成直接按当前 Tab 渲染 ——
              currentTab 本来就由组件自己从 URL 维护。 */}
          <ActiveComp
            ref={ele => (this.com = ele)}
            projectId={Config.projectId}
            featureType={featureType}
            changeTab={this.changeTab}
            changeShowHeader={visible => this.setState({ showHeader: visible })}
            updateDisabledExportBtn={disabledExportBtn => this.setState({ disabledExportBtn })}
          />
        </div>
      </div>
    );
  }
}
