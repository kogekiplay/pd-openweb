import { TinyColor } from '@ctrl/tinycolor';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { Button, SvgIcon } from 'ming-ui';
import { defaultTitleStyles, replaceTitleStyle } from 'src/pages/customPage/components/ConfigSideWrap/util';
import { getTranslateInfo } from 'src/utils/app';
import { ButtonListWrap, GraphWrap } from './styled';

const ButtonDisplayWrap = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  // padding: 20px 0;
  text-align: center;
  .title,
  .explain {
    text-align: center;
    margin-bottom: var(--space-3);
    color: var(--title-color);
  }
`;

const BtnWrap = styled.div`
  margin: var(--space-1) 0;
  padding: 0 var(--space-2);
  cursor: pointer;
  transition: border 0.25s;
  border: 1px solid transparent;
  box-sizing: border-box;
  &.noMargin {
    margin: 0;
  }
  &.isFullWidth {
    flex-grow: 1;
  }
  .ming.Button {
    display: flex;
    align-items: center;
    justify-content: center;
    div {
      display: flex;
    }
    .injected-svg {
      margin-right: 5px;
    }
  }
  button.ming {
    padding: 0 14px;
    background-color: ${props => props.color};
    font-weight: bold;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.26);
    &:hover {
      background-color: ${props => new TinyColor(props.color).darken(20).toString()};
    }
    .icon {
      font-size: var(--font-2xl);
      margin-right: 6px;
    }
  }
  &.edit {
    &:hover {
      border: 1px dashed var(--color-border-primary);
    }
    &.active {
      border: 1px solid ${props => new TinyColor(props.color).darken(20).toString()};
    }
  }
  &.adjustText {
    button {
      background-color: var(--color-background-tertiary);
      color: ${props => props.color};
      box-shadow: none;
      &:hover {
        background-color: var(--color-background-hover);
      }
    }
    .iconWrap {
      color: ${props => props.color};
      background-color: var(--color-background-secondary);
    }
  }
`;

export default function ButtonDisplay({
  themeColor,
  widget = {},
  appId,
  buttonList = [],
  layoutType = 'web',
  displayMode = 'edit',
  title,
  explain,
  activeIndex,
  count,
  mobileCount = 1,
  width,
  style,
  config,
  customPageConfig = {},
  onClick,
}: {
  // 【全部可选】调用点是 `<ButtonDisplay displayMode="" {...item} />` 这种整体展开，
  // item 里有哪些字段随按钮配置而变。不标的话解构形参会把没有默认值的那几个
  // 当成必填，展开传参就报"缺字段"。
  /** 应用主题色，按钮默认色跟着它走 */
  themeColor?: string;
  widget?: { id?: string; [key: string]: unknown };
  appId?: string;
  buttonList?: {
    id?: string;
    name?: string;
    color?: string;
    icon?: string;
    /** 按钮点击后的动作配置 */
    action?: unknown;
    [key: string]: unknown;
  }[];
  layoutType?: string;
  displayMode?: string;
  title?: string;
  explain?: string;
  /** 编辑态里当前选中的是第几个按钮 */
  activeIndex?: number;
  count?: number;
  mobileCount?: number;
  width?: number;
  /** 【是样式档位不是 CSS】1 圆角 / 3 文字色跟随按钮色…，见下面 `style === 1 / === 3` 的分支 */
  style?: number;
  /** 本组件自己的配置：btnType / direction / titleStyles… */
  /** 本组件自己的配置：btnType / direction / titleStyles… */
  config?: {
    btnType?: number;
    direction?: number;
    titleStyles?: { index?: number; [key: string]: unknown };
    [key: string]: unknown;
  };
  /** 整个自定义页的配置；标题样式按 index 与本组件的比大小，谁大用谁 */
  customPageConfig?: { titleStyles?: { index?: number; [key: string]: unknown }; [key: string]: unknown };
  /** 收的是【整个按钮对象 + 它的下标】，不是 id */
  onClick?: (btn: { index: number; [key: string]: unknown }) => void;
}) {
  const { btnType, direction = 1, titleStyles = { ...defaultTitleStyles, textAlign: 'center' } } = config || {};
  const pageTitleStyles = customPageConfig.titleStyles || {};
  // 【必须保住 NaN 语义】自定义页没配标题样式时 pageTitleStyles 是 {}，index 为 undefined。
  // 原式 `undefined >= 0` 是 false，走按钮自己的样式；若写成 `|| 0` 就变成 `0 >= 0` 为 true，
  // 标题样式会被换成那个空对象。Number(undefined) 是 NaN，比较仍恒为 false，与原式一致。
  const newTitleStyles = Number(pageTitleStyles.index) >= Number(titleStyles.index) ? pageTitleStyles : titleStyles;
  const isFullWidth = btnType === 2 ? true : width === 1;
  const isMobile = layoutType === 'mobile';
  const newList = _.chunk(buttonList, layoutType === 'web' ? count : mobileCount);

  const getWidth = () => {
    const newCount = isMobile ? mobileCount : count;
    if (isFullWidth || isMobile)
      return { width: `${100 / (buttonList.length > newCount ? newCount : buttonList.length)}%` };
    return {};
  };

  const translateInfo = getTranslateInfo(appId, null, widget.id);
  return (
    <ButtonDisplayWrap className="buttonDisplayWrap">
      <div className="flexColumn" style={{ alignItems: newTitleStyles.textAlign === 'left' ? 'start' : undefined }}>
        {title && (
          <div className="title" style={replaceTitleStyle(newTitleStyles, themeColor)}>
            {translateInfo.title || title}
          </div>
        )}
        {explain && <div className="explain">{explain ? translateInfo.description || explain : ''}</div>}
      </div>
      <ButtonListWrap>
        {newList.map((list, index) => {
          return (
            <div className={cx('chunkListWrap', { center: isMobile ? false : !isFullWidth })} key={index}>
              {list.map((item, i) => {
                const { color, name, config } = item;
                const defaultIcon = btnType === 2 ? `custom_actions` : null;
                const icon = _.get(config, 'icon') || defaultIcon;
                const iconUrl = icon
                  ? `${md.global.FileStoreConfig.pubHost}/customIcon/${icon}.svg`
                  : _.get(config, 'iconUrl');
                return (
                  <BtnWrap
                    key={i}
                    style={{ ...getWidth() }}
                    color={color}
                    className={cx(displayMode, {
                      active: activeIndex === index,
                      adjustText: style === 3,
                      noMargin: btnType === 2,
                      flexRow: direction === 2,
                    })}
                    onClick={() => {
                      if (typeof onClick === 'function') {
                        onClick({ ...item, index });
                      }
                    }}
                  >
                    {btnType === 2 ? (
                      <GraphWrap
                        className={cx('valignWrapper', direction === 1 ? 'column' : 'row', {
                          small:
                            isMobile &&
                            ((direction === 1 && [3, 4].includes(mobileCount)) ||
                              (direction === 2 && [2].includes(mobileCount))),
                        })}
                        color={color}
                        radius={style === 1 ? (direction === 1 ? '16px' : '12px') : '50%'}
                      >
                        {iconUrl && (
                          <div className="iconWrap flexRow valignWrapper">
                            <SvgIcon
                              url={iconUrl}
                              fill={style === 3 ? color : '#fff'}
                              size={
                                direction === 2 || (isMobile && direction === 1 && [3, 4].includes(mobileCount))
                                  ? 28
                                  : 36
                              }
                            />
                          </div>
                        )}
                        <div className="nameWrap valignWrapper">
                          <div className="name">{translateInfo[item.id] || name}</div>
                        </div>
                      </GraphWrap>
                    ) : (
                      <Button
                        fullWidth={isFullWidth || isMobile}
                        radius={style === 2}
                        icon={iconUrl ? null : item.icon}
                      >
                        {iconUrl && <SvgIcon url={iconUrl} fill={style === 3 ? color : '#fff'} size={20} />}
                        <span className="overflow_ellipsis">{translateInfo[item.id] || name}</span>
                      </Button>
                    )}
                  </BtnWrap>
                );
              })}
            </div>
          );
        })}
      </ButtonListWrap>
    </ButtonDisplayWrap>
  );
}
