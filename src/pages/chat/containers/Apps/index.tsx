import { Fragment, useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Popover } from 'antd';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, LoadDiv, SvgIcon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import homeAppApi from 'src/api/homeApp';
import { getAppNavigateUrl, transferExternalLinkUrl } from 'src/pages/AppHomepage/AppCenter/utils';
import type { RootState } from 'src/redux/types';
import { navigateTo } from 'src/router/navigateTo';
import { emitter } from 'src/utils/common';
import { addBehaviorLog, getCurrentProject } from 'src/utils/project';
import * as actions from '../../redux/actions';
import type { ChatToolbarConfig } from '../../redux/types';
import { PopoverWrap } from '../ChatList/Avatar/styled';

const Wrap = styled.div``;

const AppWrap = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  position: relative;
  &.active::before {
    content: '';
    position: absolute;
    left: -10px;
    top: 50%;
    height: 12px;
    width: 4px;
    border-radius: var(--radius-sm);
    -webkit-transform: translateY(-50%);
    -ms-transform: translateY(-50%);
    transform: translateY(-50%);
    background: var(--color-primary);
  }
  > div {
    pointer-events: none;
  }
`;

const ArrowWrap = styled.div`
  width: 26px;
  border-radius: var(--radius-sm);
  .icon {
    transition: 0.2s;
  }
  &:hover {
    background-color: var(--color-background-hover);
    .icon {
      transform: rotateZ(90deg);
    }
  }
`;

/**
 * props：connect 注入 `appId`（`RootState['appPkg'].id`，PageHeader/redux/types.ts AppPkgState）、
 * `toolbarConfig`（`RootState['chat'].toolbarConfig`，chat/redux/types.ts ChatState）与
 * `setToolbarConfig`（chat/redux/actions.ts:2089 的真实签名）。
 */
export interface AppsProps {
  appId: string | undefined;
  toolbarConfig: ChatToolbarConfig;
  setToolbarConfig: (config: Partial<ChatToolbarConfig>) => void;
}

const getShowAppsCount = (height: number) => {
  const appHeight = 26;
  const marginBottom = 10;
  const moreHeight = 8;
  // 原为 parseInt(number)：先隐式 toString 再解析，量级异常时（如 1e21）会得到完全错误的值。
  // Math.trunc 与当前输入域内的 parseInt 行为等价，且不依赖字符串化。
  return Math.trunc((height - moreHeight) / (appHeight + marginBottom));
};

const onAddBehaviorLog = item => {
  switch (item.type) {
    case 0:
      addBehaviorLog('app', item.id);
      break;
    case 1:
      addBehaviorLog('customPage', item.itemId);
      break;
    case 2:
      addBehaviorLog('worksheet', item.itemId);
      break;
    default:
      addBehaviorLog('app', item.id);
      break;
  }
};

const getProjectId = () => {
  const currentProject = getCurrentProject(localStorage.getItem('currentProjectId'));
  return currentProject.projectId || _.get(md.global.Account.projects[0], 'projectId');
};

const Apps = (props: AppsProps) => {
  const { appId, toolbarConfig, setToolbarConfig } = props;
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [appShowCount, setAppShowCount] = useState(0);
  const appsWrap = useRef(null);
  const { commonAppShowType = 1, commonAppOpenType } = toolbarConfig;

  /**
   * 【保留原隐式 any 债，不假签 item 形状】真实条目来自
   * `commonAppShowType === 1 ? recentApps : marketApps` 的联合；`marketApps` 在 src/api 层
   * 没有返回标注（`ApiResult` = `Promise<any>`），所以 `setApps` 收到的仍是 any，state 的
   * never[] 债也无法诚实消除。**不给 app/state 标未认证模型**（不把 any 认证成 finite）；
   * 要闭环须先按 Lead 的 producer scope 给 `marketApps` 补 generated 返回（见 REPORT swagger 证据）。
   */
  const handleOpenApp = app => {
    onAddBehaviorLog(app);
    if (app.createType === 1) {
      window.open(transferExternalLinkUrl(app.urlTemplate, app.projectId, app.id));
    } else {
      const url = getAppNavigateUrl(app.id, app.pcNaviStyle, app.selectAppItmeType);
      commonAppOpenType === 1 ? navigateTo(url) : window.open(url);
    }
  };

  const getApps = () => {
    const api = commonAppShowType === 1 ? homeAppApi.recentApps : homeAppApi.marketApps;
    const projectId = getProjectId();

    if (projectId) {
      setLoading(true);
      api({
        noCache: false,
        projectId: getProjectId(),
      }).then(data => {
        setToolbarConfig({
          hideOpenCommonApp: data.length ? false : true,
        });
        setApps(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    getApps();
  }, [commonAppShowType]);

  useEffect(() => {
    emitter.addListener('CHANGE_CURRENT_PROJECT', getApps);
    return () => {
      emitter.removeListener('CHANGE_CURRENT_PROJECT', getApps);
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;

    const resizeObserver = new ResizeObserver(() => {
      if (appsWrap.current) {
        setAppShowCount(getShowAppsCount(_.get(appsWrap.current, 'clientHeight') || 0));
      }
    });

    if (appsWrap.current) {
      resizeObserver.observe(appsWrap.current);
    }

    return () => {
      if (appsWrap.current) {
        resizeObserver.unobserve(appsWrap.current);
      }
    };
  }, []);

  const navApps = apps.slice(0, appShowCount);
  const popoverApps = apps.slice(appShowCount);

  return (
    <Fragment>
      <Wrap className="flexColumn alignItemsCentern flex minHeight0" ref={appsWrap}>
        {loading ? (
          <div className="flexColumn alignItemsCentern justifyContentCenter h100">
            <LoadDiv />
          </div>
        ) : (
          <Fragment>
            {navApps.map(app => (
              <Tooltip key={app.id} placement="left" align={{ offset: [-5, 0] }} title={app.name} mouseLeaveDelay={0.1}>
                <AppWrap
                  className={cx('flexRow alignItemsCenter justifyContentCenter pointer mBottom10', {
                    active: appId === app.id,
                  })}
                  style={{ backgroundColor: app.iconColor }}
                  onClick={() => handleOpenApp(app)}
                >
                  <SvgIcon url={app.iconUrl} fill="#fff" size={20} />
                </AppWrap>
              </Tooltip>
            ))}
            {!!popoverApps.length && (
              <Popover
                title={null}
                placement="leftBottom"
                classNames={{ root: 'userConfigPopover' }}
                styles={{ root: { padding: 0 } }}
                content={
                  <PopoverWrap
                    style={{
                      width: 260,
                      maxHeight: (document.body?.clientHeight || window.innerHeight) / 1.2,
                      overflowY: 'auto',
                    }}
                  >
                    {popoverApps.map((app, index) => (
                      <div
                        key={index}
                        className={cx('itemWrap pointer flexRow alignItemsCenter', { active: appId === app.id })}
                        onClick={() => handleOpenApp(app)}
                      >
                        <AppWrap
                          className="flexRow alignItemsCenter justifyContentCenter"
                          style={{ backgroundColor: app.iconColor }}
                        >
                          <SvgIcon url={app.iconUrl} fill="#fff" size={18} />
                        </AppWrap>
                        <div className="flex mLeft8 ellipsis" title={app.name}>
                          {app.name}
                        </div>
                      </div>
                    ))}
                  </PopoverWrap>
                }
              >
                <ArrowWrap className="flexRow alignItemsCenter justifyContentCenter pointer">
                  <Icon className="Font18 textSecondary" icon="arrow-up-border1" />
                </ArrowWrap>
              </Popover>
            )}
          </Fragment>
        )}
      </Wrap>
    </Fragment>
  );
};

export default connect(
  (state: RootState) => ({
    appId: state.appPkg.id,
    toolbarConfig: state.chat.toolbarConfig,
  }),
  dispatch => bindActionCreators(_.pick(actions, ['setToolbarConfig']), dispatch),
)(Apps);
