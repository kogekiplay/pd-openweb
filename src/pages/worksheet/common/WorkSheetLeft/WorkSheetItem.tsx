import { Component, Fragment } from 'react';
import { TinyColor } from '@ctrl/tinycolor';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Icon, MdLink, SvgIcon } from 'ming-ui';
import { Tooltip } from 'ming-ui/antd-components';
import { getEmbedValue } from 'src/components/Form/core/formUtils/helper';
import { transferValue } from 'src/pages/widgetConfig/widgetSetting/components/DynamicDefaultValue/util';
import { canEditApp, canEditData } from 'src/pages/worksheet/redux/actions/util';
import { getTranslateInfo } from 'src/utils/app';
import { addBehaviorLog } from 'src/utils/project';
import Drag from './Drag';
import MoreOperation from './MoreOperation';

const Wrap = styled.div`
  &.active .name::before {
    background-color: ${props => props.iconColor} !important;
  }
`;

export function convertColor(colorStr) {
  return colorStr ? new TinyColor(colorStr).setAlpha(0.1) : 'var(--color-primary-transparent)';
}

export interface WorkSheetItemState {
  flag?: number | undefined;
}

export default class WorkSheetItem extends Component<any, WorkSheetItemState> {
  constructor(props) {
    super(props);
    this.state = {};
  }
  svgColor(isActive: boolean) {
    const { iconColor, currentPcNaviStyle, themeType } = this.props.appPkg;
    const darkColor = [1, 3].includes(currentPcNaviStyle) && !['light'].includes(themeType);

    if (darkColor) {
      return `rgba(255, 255, 255, ${isActive ? 1 : 0.9})`;
    } else if ([1, 3].includes(currentPcNaviStyle)) {
      return isActive || ['light'].includes(themeType) ? iconColor : 'var(--color-text-secondary)';
    } else {
      return isActive ? iconColor : 'var(--color-text-secondary)';
    }
  }
  textColor(isActive: boolean) {
    const { currentPcNaviStyle, themeType } = this.props.appPkg;
    const darkColor = [1, 3].includes(currentPcNaviStyle) && !['light'].includes(themeType);
    /* 【选中项的文字走 --color-primary-text，不要直接用 appPkg.iconColor】
       选中态的底是同色 10% 浅底（下面的 bgColor），原色压上去实测：
       亮色 ~3.5、暗色只有 2.48（暗色下 --color-primary 会被 darkAlgorithm 调过，
       而这里读的是原始 iconColor，于是连引擎调整都吃不到）。
       --color-primary-text 就是引擎按同一个 iconColor 算出来的"当文字用"那一档，
       明暗两边方向都对。图标（svgColor）仍用原色 —— 非文本对比只要 3:1。 */
    return darkColor
      ? `rgba(255, 255, 255, ${isActive ? 1 : 0.9})`
      : isActive
        ? 'var(--color-primary-text)'
        : undefined;
  }
  bgColor() {
    const { iconColor, currentPcNaviStyle, themeType } = this.props.appPkg;

    if ([1, 3].includes(currentPcNaviStyle) && !['light'].includes(themeType)) {
      return themeType === 'theme' ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
    } else {
      return convertColor(iconColor);
    }
  }
  getNavigateUrl(isActive: boolean) {
    const { appId, groupId, appItem } = this.props;
    const { workSheetId } = appItem;
    const storage = JSON.parse(localStorage.getItem(`mdAppCache_${md.global.Account.accountId}_${appId}`)) || {};
    const viewId =
      (_.find(storage.worksheets || [], item => item.groupId === groupId && item.worksheetId === workSheetId) || {})
        .viewId || '';
    let url = `/app/${appId}/${groupId}/${workSheetId}${viewId ? `/${viewId}` : ''}`;

    if (isActive) {
      url += `?flag=${this.state.flag || Date.now()}`;
    }

    return url;
  }
  override render() {
    const {
      projectId,
      appId,
      groupId,
      appItem,
      activeSheetId,
      className,
      isCharge,
      appPkg,
      sheetListVisible,
      disableTooltip,
    } = this.props;
    const { workSheetId, iconUrl, status, parentStatus, type, configuration = {}, urlTemplate, layerIndex } = appItem;
    const workSheetName = getTranslateInfo(appId, null, workSheetId).name || appItem.workSheetName;
    const isActive = activeSheetId === workSheetId;
    const { currentPcNaviStyle, displayIcon = '', hideFirstSection } = appPkg;
    const showIcon =
      currentPcNaviStyle === 3 && hideFirstSection && appItem.firstGroupIndex === 0
        ? true
        : displayIcon.split('')[layerIndex] === '1';
    const isNewOpen = configuration.openType == '2';
    const url = this.getNavigateUrl(isActive);
    const isEditApp = canEditApp(_.get(appPkg, ['permissionType']), _.get(appPkg, ['isLock']));

    const handleNewOpen = () => {
      const dataSource = transferValue(urlTemplate);
      const urlList: string[] = [];
      dataSource.map(o => {
        if (o.staticValue) {
          urlList.push(o.staticValue);
        } else {
          urlList.push(
            getEmbedValue(
              {
                projectId,
                appId,
                groupId,
                worksheetId: workSheetId,
              },
              o.cid,
            ),
          );
        }
      });
      try {
        window.open(urlList.join(''));
      } catch {
        alert(_l('请输入正确的url'), 3);
      }
    };

    const renderHideIcon = () => {
      let icon = 'visibility_off';

      if (status === 3 || parentStatus === 3) {
        icon = 'desktop_off';
      }

      if (status === 4 || parentStatus === 4) {
        icon = 'mobile_off';
      }

      return (
        ([2, 3, 4].includes(status) || [2, 3, 4].includes(parentStatus)) && (
          <Tooltip
            placement="right"
            title={_l('仅系统角色在导航中可见（包含管理员、开发者），应用项权限依然遵循角色权限原则')}
          >
            <Icon
              className="Font16 mRight10 visibilityIcon"
              icon={icon}
              style={{
                color: 'var(--color-warning)',
              }}
            />
          </Tooltip>
        )
      );
    };

    const Content = (
      <Fragment>
        {showIcon && (
          <div className="iconWrap mRight10">
            <SvgIcon url={iconUrl} fill={this.svgColor(isActive)} size={22} />
          </div>
        )}
        <span
          className={cx('name ellipsis Font14 mRight10', {
            bold: isActive,
            pLeft8: !showIcon && layerIndex === 2 && [1].includes(currentPcNaviStyle),
          })}
          title={workSheetName}
          style={{ color: this.textColor(isActive) }}
        >
          {workSheetName}
        </span>
        {isNewOpen && (
          <Tooltip placement="bottom" title={_l('新页面打开')}>
            <Icon className="Font16 mRight10 mTop2 openIcon" icon="launch" />
          </Tooltip>
        )}
        {isEditApp && renderHideIcon()}
      </Fragment>
    );
    return (
      <Drag appItem={appItem} appPkg={appPkg} isCharge={isCharge}>
        <Tooltip
          align={{ offset: [-10, 0] }}
          placement="right"
          title={
            (_.isUndefined(disableTooltip) ? sheetListVisible : disableTooltip) ? '' : <span>{workSheetName}</span>
          }
        >
          <Wrap
            style={{
              backgroundColor: isActive && this.bgColor(),
            }}
            iconColor={['black'].includes(appPkg.themeType) ? appPkg.iconColor : ''}
            className={cx('workSheetItem flexRow Relative', className, `workSheetItem-${workSheetId}`, {
              active: isActive,
            })}
            data-id={workSheetId}
          >
            {isNewOpen ? (
              <div className="NoUnderline valignWrapper h100 nameWrap" onClick={handleNewOpen}>
                {Content}
              </div>
            ) : (
              <MdLink
                className="NoUnderline valignWrapper h100 nameWrap stopPropagation"
                to={url}
                onClick={() => {
                  if (type == 0) {
                    //浏览工作表埋点
                    addBehaviorLog('worksheet', workSheetId);
                  }

                  if (type == 1) {
                    //浏览自定义页面埋点
                    addBehaviorLog('customPage', workSheetId);
                  }

                  if (type == 3) {
                    // 对话机器人
                    addBehaviorLog('robot', workSheetId);
                  }

                  this.setState({ flag: Date.now() });
                }}
              >
                {Content}
              </MdLink>
            )}

            {!(
              !canEditApp(_.get(appPkg, ['permissionType'])) &&
              !canEditData(_.get(appPkg, ['permissionType'])) &&
              (window.isPublicApp || md.global.Account.isPortal)
            ) && (
              <MoreOperation {...this.props}>
                <div className="rightArea moreBtn">
                  <Icon icon="more_horiz" className="Font18 moreIcon" />
                </div>
              </MoreOperation>
            )}
          </Wrap>
        </Tooltip>
      </Drag>
    );
  }
}
