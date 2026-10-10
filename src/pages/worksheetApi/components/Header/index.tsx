import React, { Fragment, memo, useState } from 'react';
import { generate } from '@ant-design/colors';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, SvgIcon } from 'ming-ui';
import DocumentTitle from 'ming-ui/components/DocumentTitle';
import Share from 'worksheet/components/Share';
import CreateByMingDaoYun from 'src/components/CreateByMingDaoYun';
import PublicAppLangDropdown from 'src/components/PublicAppLangDropdown';
import { navigateTo } from 'src/router/navigateTo';
import { browserIsMobile } from 'src/utils/common';
import { TAB_TYPE } from '../../core/enum';
import Beta from '../Beta';

export interface HeaderDataApp {
  appIconColor?: string | undefined;
  appNavColor?: string | undefined;
  appName?: string | undefined;
  appIcon?: string | undefined;
  iconUrl?: string | undefined;
  name?: string | undefined;
  projectId?: string | undefined;
  iconColor?: string | undefined;
  navColor?: string | undefined;
}
export interface HeaderProps {
  isAuthorization?: boolean | undefined;
  isSharePage?: boolean | undefined;
  data?: unknown;
  dataApp?: HeaderDataApp;
  appId?: string | undefined;
  appInfo?: { apiRequest?: { appKey?: string | undefined } | undefined } | undefined;
  tabIndex?: string;
  updateTabIndex?: (value: string) => void;
  getId?: () => string | undefined;
  share?: { data?: HeaderDataApp | undefined };
}

const HeaderWrap = styled.header`
  position: relative;
  display: flex;
  justify-content: ${props => (props.isAuthorization ? 'flex-start' : 'space-between')};
  padding: 0 30px;
  font-size: 17px;
  height: 50px;
  background: var(--color-background-primary);
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  z-index: 1;
  line-height: 50px;

  .shareButtonBox {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }
  .shareButton {
    height: 36px;
    padding: 0 15px;
    border: 1px solid #e0e0e0;
    border-radius: 20px;
    &:hover {
      border-color: var(--color-primary);
      text-decoration: none;
      i,
      span {
        color: var(--color-primary);
      }
    }
  }

  .appIconWrapIcon {
    display: inline-block;
    border-radius: var(--radius-sm);
    color: #fff;
    margin-right: 10px;
    width: 30px;
    height: 30px;
    line-height: 30px;
    text-align: center;
  }

  .appName {
    display: inline;
  }

  .flexNone {
    flex: none;
  }

  .worksheetApiTabsBox {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    gap: 50px;
    height: 50px;
    .worksheetApiTab {
      display: flex;
      align-items: center;
      padding: 0 14px;
      font-size: 15px;
      color: var(--color-text-primary);
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s ease-out;
      border-bottom: 3px solid transparent;
      & > span {
        display: flex;
        align-items: center;
        &:hover {
          color: var(--color-primary-text);
        }
      }
      &.active {
        color: var(--color-primary-text);
        border-color: var(--color-primary);
      }
    }
  }
`;

const TABS_OPTS = [
  { tabIndex: TAB_TYPE.APPLICATION, name: _l('应用授权') },
  { tabIndex: TAB_TYPE.API_V3, name: _l('API V3') },
  { tabIndex: TAB_TYPE.API_V2, name: _l('API V2') },
];
const isMobile = browserIsMobile();

const getIconColor = ({ iconColor, navColor }: { iconColor?: string | undefined; navColor?: string | undefined }) => {
  // The existing SDK accepts absent color at runtime; preserve its own fallback.
  const palette: unknown = Reflect.apply(generate, undefined, [iconColor]);
  if (!Array.isArray(palette) || !Array.from(palette).every(value => typeof value === 'string'))
    throw new TypeError('Invalid generated API icon palette');
  const lightColor: string | undefined = palette[0];
  const light = [lightColor, '#ffffff', '#f5f6f7'].includes(navColor);
  const black = '#1b2025' === navColor;
  const backgroundColor = light ? lightColor : navColor || iconColor;
  const fillColor = black || light ? iconColor : '#fff';
  return { backgroundColor, fillColor };
};

const CommonHeader = (props: HeaderProps) => {
  const { data, dataApp, appId, isSharePage, appInfo, tabIndex, updateTabIndex, getId = () => undefined } = props;
  if (!dataApp) throw new TypeError('Missing worksheet API header application');
  const { backgroundColor, fillColor } = getIconColor(dataApp);
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const [shareVisible, setShareVisible] = useState(false);

  const externalLink = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    const lang = window.getCurrentLang();
    window.open(
      `${md.global.Config.OpenApiDocUrl}/application_v3/appkey-sign/${lang === 'zh-Hans' ? 'zh-Hans' : 'en'}/?ts=${Date.now()}&theme=${theme}`,
      '_blank',
    );
  };

  return (
    <HeaderWrap className="flexRow">
      <div className="ellipsis">
        {!!data && (
          <Fragment>
            <span
              className="appIconWrapIcon"
              style={{ backgroundColor }}
              onClick={() => {
                navigateTo(`/app/${appId}`);
              }}
            >
              <SvgIcon url={dataApp.iconUrl} fill={fillColor} size={24} addClassName="mTop3" />
            </span>
            <span
              className="appName Hand bold mRight5"
              onClick={() => {
                navigateTo(`/app/${appId}`);
              }}
            >
              {dataApp.name}
            </span>
            <span>{_l('API说明')}</span>
          </Fragment>
        )}
      </div>
      {isMobile && isSharePage ? (
        <CreateByMingDaoYun className="flexNone" />
      ) : (
        <React.Fragment>
          <div className="worksheetApiTabsBox flex">
            {!isSharePage &&
              TABS_OPTS.map((item, i) => (
                <div
                  key={i}
                  className={cx('worksheetApiTab', {
                    active: tabIndex === item.tabIndex,
                  })}
                  onClick={() => {
                    if (!updateTabIndex) throw new TypeError('Missing worksheet API tab callback');
                    updateTabIndex(item.tabIndex);
                  }}
                >
                  <span>
                    {item.name}
                    {item.tabIndex === TAB_TYPE.API_V3 && <Beta />}
                  </span>
                </div>
              ))}
          </div>

          <div className="shareButtonBox">
            {isSharePage && <PublicAppLangDropdown className="mRight16" appId={appId} projectId={dataApp.projectId} />}
            {tabIndex === TAB_TYPE.API_V3 && (
              <div className="shareButton Hand textSecondary flexRow valignWrapper mRight16" onClick={externalLink}>
                <Icon icon="external_collaboration" className="mRight8 Font18" />
                <span className="Font14">{_l('打开')}</span>
              </div>
            )}
            {!window.platformENV.isOverseas && !window.platformENV.isLocal && (
              <a
                className="shareButton Hand textSecondary flexRow valignWrapper"
                target="_blank"
                href="https://apifox.mingdao.com/"
              >
                <Icon icon="play_arrow" className="mRight8 Font18" />
                <span className="Font14">{_l('调试')}</span>
              </a>
            )}
            {!isSharePage && tabIndex !== TAB_TYPE.API_V3 && (
              <div
                className="shareButton Hand textSecondary flexRow valignWrapper mLeft16"
                onClick={() => setShareVisible(true)}
              >
                <Icon icon="share" className="mRight8 Font18" />
                <span className="Font14">{_l('分享')}</span>
              </div>
            )}
          </div>
          {shareVisible && (
            <Share
              title={_l('分享文档')}
              from="worksheetApi"
              isCharge={true}
              params={{
                appId,
                sourceId: appInfo?.apiRequest?.appKey || getId(),
                title: _l('API说明'),
              }}
              onClose={() => setShareVisible(false)}
            />
          )}
        </React.Fragment>
      )}
    </HeaderWrap>
  );
};

const AuthorizationHeader = (props: HeaderProps) => {
  const { share = {} } = props;
  const { appIconColor, appNavColor } = share.data || {};
  const { backgroundColor, fillColor } = getIconColor({ iconColor: appIconColor, navColor: appNavColor });
  return (
    <HeaderWrap isAuthorization={true}>
      {share.data && (
        <React.Fragment>
          <span className="appIconWrapIcon" style={{ backgroundColor }}>
            <SvgIcon url={share.data.appIcon} fill={fillColor} size={24} addClassName="mTop3" />
          </span>
          <span className="appName Hand bold mRight5">{share.data.appName}</span>
          {share.data.appName && <DocumentTitle title={`${share.data.appName}-${_l('API说明')}`} />}
        </React.Fragment>
      )}
      {_l('API说明')}
    </HeaderWrap>
  );
};

const Header = (props: HeaderProps) => {
  const { isAuthorization = false, ...rest } = props;
  const Component = isAuthorization ? AuthorizationHeader : CommonHeader;

  return <Component {...rest} />;
};

export default memo(Header);
