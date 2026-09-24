import React, { Component, Fragment } from 'react';
import { shallowEqual } from 'react-redux';
import Trigger from '@rc-component/trigger';
import type { TriggerRef } from '@rc-component/trigger';
import type { CSSProperties, ReactNode } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import Icon from './Icon';
import LoadDiv from './LoadDiv';
import Menu from './Menu';
import MenuItem from './MenuItem';
import './less/Dropdown.less';

/** 下拉里的一项（value 的类型见 DropdownOption）。data 里也可以直接放一组项（数组），组与组之间画分隔线 */
export interface DropdownItem {
  text?: ReactNode;
  /** text 不是字符串时，搜索按它匹配 */
  searchText?: string | undefined;
  disabled?: boolean | undefined;
  /** 在这一项上方画一行灰色小标题 */
  title?: ReactNode;
  /** 只当一行提示文字显示，不能选 */
  isTip?: boolean | undefined;
  className?: string | undefined;
  /** 左侧图标名（icon 是旧名字，两者都认） */
  iconName?: string | undefined;
  icon?: string | undefined;
  iconAtEnd?: boolean | undefined;
  iconHint?: string | undefined;
  /** 取选中项的显示文字时会往下找的子项 */
  children?: DropdownItem[] | undefined;
}

/**
 * Item 推不出来时的兜底（data 还是 any）：项上可以有任意字段 —— 和 V 退回 any 同一个道理，
 * 调用方的数据本身没类型，renderItem 里读 item.hasPay 这类自带字段就不该凭空报错。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedDropdownItem = DropdownItem & { [field: string]: any };

/** 一项 = 调用方自己的项类型 Item（可以带任意额外字段）+ 值类型为 V 的 value */
export type DropdownOption<V, Item extends DropdownItem = DropdownItem> = Item & { value?: V };

/**
 * 两个类型参数都从调用点推出来：
 * - V（值的类型）从 data 里项的 value、value / defaultValue、onChange 回调的参数标注里推；
 * - Item 从 data 推，调用方项上带的额外字段在 renderItem / renderTitle 里照样有类型。
 * 什么都推不出来（data 还是 any、又没给 value）时 V 退回 any —— 这时候调用方的数据本身就没类型，
 * 这里跟着是 any，不另外制造 unknown 逼调用方先去写 data 的类型。
 */
interface DropdownProps<V, Item extends DropdownItem> {
  // 平铺数组和「含分组的数组」分成两支写：写成一个 (项 | 项[])[] 时，项的形状不齐（有的带 disabled、有的不带）
  // 的 data 推不出 Item，会整个报错
  data?: readonly DropdownOption<V, Item>[] | readonly (DropdownOption<V, Item> | readonly DropdownOption<V, Item>[])[] | undefined;
  value?: V | undefined;
  defaultValue?: V | undefined;
  /**
   * 参数是选中项的 value。可能是 undefined：给了 cancelAble 时点清除按钮，或者选中的项本身没写 value。
   */
  onChange?: ((value: V | undefined) => void) | undefined;
  /** 输入框右侧带清除按钮 */
  cancelAble?: boolean | undefined;
  placeholder?: ReactNode;
  onVisibleChange?: ((visible: boolean) => void) | undefined;
  /** 给了就由调用方搜：打开时调一次（不带参数），之后每次输入带上关键字 */
  onSearch?: ((keywords?: string) => void) | undefined;
  renderItem?: ((item: DropdownOption<V, Item>) => ReactNode) | undefined;
  /** 输入框里显示什么；参数是选中的那一项（在 data 里没找到时是 undefined） */
  renderTitle?: ((selected: DropdownOption<V, Item> | undefined) => ReactNode) | undefined;
  /** 当前值不在 data 里时显示什么 */
  renderError?: (() => ReactNode) | undefined;
  /** 没给 renderTitle 时的显示模板，{{value}} 换成选中项的 text；默认 '{{value}}' */
  renderValue?: string | undefined;
  /** 完全自定义输入框那一块 */
  renderPointer?: (() => ReactNode) | undefined;
  noData?: ReactNode;
  /** 本地搜索搜不到时显示什么 */
  searchNull?: (() => ReactNode) | undefined;
  itemLoading?: boolean | undefined;
  disabled?: boolean | undefined;
  /** 选了之后不改自己显示的值（完全跟外部 value 走） */
  noChangeValue?: boolean | undefined;
  /** 选完是否收起，默认收起 */
  selectClose?: boolean | undefined;
  /** 由外部控制是否展开 */
  popupVisible?: boolean | undefined;
  /** 每一项带上 title，悬停看全文 */
  showItemTitle?: ReactNode;
  /** 当前选中项额外加的类名 */
  currentItemClass?: string | undefined;
  /** value 在这里面的项不显示 */
  hiddenValue?: V[] | undefined;
  maxHeight?: number | undefined;
  menuStyle?: CSSProperties | undefined;
  menuClass?: string | undefined;
  children?: ReactNode;
  /** 下拉层挂到 body 上（用 Trigger 定位）；否则跟在输入框下面 */
  isAppendToBody?: boolean | undefined;
  /** 下拉顶部带搜索框 */
  openSearch?: boolean | undefined;
  dropIcon?: string | undefined;
  /** 点在这些元素（选择器）上时不展开 */
  disabledClickElement?: string | undefined;
  /** 悬停时变主题色 */
  hoverTheme?: boolean | undefined;
  border?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  /** isAppendToBody 时的对齐点，默认 ['tl', 'bl'] */
  points?: string[] | undefined;
  /** isAppendToBody 时的偏移，默认 [0, 1] */
  offset?: number[] | undefined;
  name?: string | undefined;
}

interface DropdownState<V> {
  value: V | undefined;
  showMenu: boolean;
  keywords: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- V 的兜底，见 DropdownProps 的说明
class Dropdown<V = any, Item extends DropdownItem = UntypedDropdownItem> extends Component<
  DropdownProps<V, Item>,
  DropdownState<V>
> {
  // 下面三个都在 ref 回调里赋值
  declare search?: HTMLInputElement | null;
  declare _input?: HTMLDivElement | null;
  declare trigger?: TriggerRef | null;

  static override propTypes = {
    /**
     * 未选择时的默认提示
     */
    placeholder: PropTypes.string,
    /**
     * 回调，参数为选中item的value值
     */
    onChange: PropTypes.func,
    defaultValue: PropTypes.any,
    value: PropTypes.any,
    /**
     * 禁用 Dropdown
     */
    disabled: PropTypes.bool,
    /**
     * Menu的样式
     */
    menuStyle: PropTypes.object,
    /**
     * Menu的样式名
     */
    menuClass: PropTypes.string,
    currentItemClass: PropTypes.object,
    /**
     * 表单item名字
     */
    name: PropTypes.string,
    /**
     * 下拉列表最高高度
     */
    maxHeight: PropTypes.number,
    className: PropTypes.string,
    hoverTheme: PropTypes.bool, // hover变成主题色
    /**
     * 空状态
     */
    noData: PropTypes.node,
    /**
     * 样式
     */
    style: PropTypes.object,
    /**
     * item是否显示title
     */
    showItemTitle: PropTypes.bool,
    /**
     * 数据
     */
    /** border样式 */
    border: PropTypes.bool,
    // 是否不更新组件value
    noChangeValue: PropTypes.bool,
    data: PropTypes.arrayOf(
      PropTypes.oneOfType([
        PropTypes.shape({
          /**
           *  默认default  hr为分割线
           */
          type: PropTypes.oneOf(['hr', 'default']),
          text: PropTypes.any,
          /**
           * 接收任何类型，并返回原始值
           */
          value: PropTypes.any,
          /**
           * 是否禁用
           */
          disabled: PropTypes.bool,
          /**
           * 说明
           */
          desc: PropTypes.string,
          /**
           * 字体图标的名字
           */
          iconName: PropTypes.string,
          /**
           * 图标后置
           */
          iconAtEnd: PropTypes.bool,
          /**
           * 图标 hint
           */
          iconHint: PropTypes.string,
          Children: PropTypes.array,
          /** 显示结果 */
          renderValue: PropTypes.string,
          searchText: PropTypes.string,
        }),
        PropTypes.arrayOf(
          PropTypes.shape({
            /**
             *  默认default  hr为分割线
             */
            type: PropTypes.oneOf(['hr', 'default']),
            text: PropTypes.any,
            /**
             * 接收任何类型，并返回原始值
             */
            value: PropTypes.any,
            /**
             * 是否禁用
             */
            disabled: PropTypes.bool,
            /**
             * 说明
             */
            desc: PropTypes.string,
            /**
             * 字体图标的名字
             */
            iconName: PropTypes.string,
            /**
             * 图标后置
             */
            iconAtEnd: PropTypes.bool,
            /**
             * 图标 hint
             */
            iconHint: PropTypes.string,
            Children: PropTypes.array,
            /** 显示结果 */
            renderValue: PropTypes.string,
          }),
        ),
      ]),
    ),
    /**
     * 菜单展开状态变更回调
     */
    onVisibleChange: PropTypes.func,
    /**
     * 通过onVisibleChange异步获取下拉列表 loading状态
     */
    itemLoading: PropTypes.bool,
    /**
     * render title
     */
    renderTitle: PropTypes.func,
    isAppendToBody: PropTypes.bool,
    selectClose: PropTypes.bool,
    openSearch: PropTypes.bool,
    cancelAble: PropTypes.bool, //可取消的
    renderError: PropTypes.func, // 错误结果显示
    disabledClickElement: PropTypes.string, // 禁止点击的元素（id、class）
    renderItem: PropTypes.func,
    onSearch: PropTypes.func, // 搜索
  };

  static defaultProps = {
    noData: _l('无数据'),
    placeholder: _l('请选择'),
    renderValue: '{{value}}',
    isAppendToBody: false,
    selectClose: true,
    openSearch: false,
    onVisibleChange: () => {},
    disabledClickElement: '',
  };

  constructor(props: DropdownProps<V, Item>) {
    super(props);
    let value: V | undefined;

    if (props.defaultValue !== undefined) {
      value = props.defaultValue;
    }

    if (props.value !== undefined) {
      value = props.value;
    }

    this.state = {
      value,
      showMenu: false,
      keywords: '',
    };
  }

  getTextFromDataById(data: readonly DropdownOption<V, Item>[] | readonly (DropdownOption<V, Item> | readonly DropdownOption<V, Item>[])[] | undefined, value: V | undefined) {
    let text = this.props.placeholder;

    const getTextFromList = list => {
      list.forEach(item => {
        if (item.value != undefined && item.value === value) {
          text = item.text;
          return false;
        } else if (item.children) {
          getTextFromList(item.children);
        } else if (_.isArray(item)) {
          getTextFromList(item);
        }
        return undefined;
      });
    };

    getTextFromList(data);
    return text;
  }

  handleClick() {
    if (this.props.disabled) {
      return;
    } else {
      const visible = !this.state.showMenu;
      this.props.onSearch && this.props.onSearch();
      this.setState(
        {
          showMenu: visible,
          keywords: '',
        },
        () => {
          this.props.onVisibleChange(visible);
          if (this.state.showMenu && this.search) {
            this.search.focus();
          }
        },
      );
    }
  }

  handleChange(_event: React.MouseEvent<HTMLLIElement, MouseEvent>, item) {
    if (item.disabled) {
      return;
    }

    if (this.props.value == undefined && !this.props.noChangeValue) {
      this.setState({
        value: item.value,
      });
    }

    if (this.props.selectClose) {
      this.setState({
        showMenu: false,
      });
      this.props.onVisibleChange(false);
    }

    if (this.props.onChange) {
      this.props.onChange(item.value);
    }
  }

  override componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (this.props.value !== prevProps.value) {
        this.setState({
          value: this.props.value,
        });
      }

      if (_.isBoolean(this.props.popupVisible)) {
        this.setState({
          showMenu: this.props.popupVisible,
        });
      }
    }

    // rc-trigger 5 的实例方法叫 forcePopupAlign，继任的 @rc-component/trigger
    // 改名为 forceAlign（es/index.js:285 的 useImperativeHandle）。
    // 这里原本是【无守卫】直调，迁移后直接抛
    //   TypeError: this.trigger.forcePopupAlign is not a function
    // 而且是在 componentDidUpdate 里抛，会被 ErrorBoundary 接住 —— 整块工作表视图
    // 变成错误页（实测触发点：点视图的「排序」）。加上 ?. 是为了万一 ref 还没挂上。
    this.trigger?.forceAlign?.();
  }

  filterFun(item) {
    const { keywords } = this.state;
    const text = typeof item.text === 'string' ? item.text : item.searchText || '';

    return String(text).toLowerCase().indexOf(keywords.toLowerCase()) > -1;
  }

  checkIsNull(item) {
    if (!item.length) return true;
    if (item.length && _.isArray(item[0]) && !item.filter(o => o.length).length) return true;

    return false;
  }

  renderListItem(data) {
    const { showItemTitle, currentItemClass, value, renderItem, hiddenValue = [] } = this.props;

    return data
      .filter(item => !_.includes(hiddenValue, item.value))
      .map((item, index: number) => {
        if (_.isArray(item)) {
          return (
            <Fragment key={index}>
              {this.renderListItem(item)}
              {!!item.length && <div className="Dropdown--hr" />}
            </Fragment>
          );
        } else {
          return (
            <Fragment key={index}>
              {item.title ? (
                <li className="ming MenuItem ming Item title">
                  <div className="pLeft16 pRight16 textTertiary ellipsis">{item.title}</div>
                </li>
              ) : null}
              {item.isTip ? (
                <li className="ming MenuItem ming Item title">
                  <div className="pLeft16 pRight16">{item.text}</div>
                </li>
              ) : (
                <MenuItem
                  {...item}
                  className={cx(item.className, value === item.value && currentItemClass ? currentItemClass : '')}
                  data-value={item.value}
                  icon={
                    item.iconName || item.icon ? <Icon icon={item.iconName || item.icon} hint={item.iconHint} /> : null
                  }
                  iconAtEnd={item.iconAtEnd}
                  iconHint={item.iconHint}
                  onClick={event => {
                    event.stopPropagation();
                    this.handleChange(event, item);
                  }}
                  title={showItemTitle && item.text}
                >
                  {renderItem ? renderItem(item) : <div className="itemText">{item.text}</div>}
                </MenuItem>
              )}
            </Fragment>
          );
        }
      });
  }

  getInputWidth = () => {
    if (this.props.isAppendToBody && this._input) {
      return { width: this._input.getBoundingClientRect().width };
    }

    return {};
  };

  displayMenu = () => {
    const { showMenu, keywords } = this.state;
    const {
      data,
      maxHeight,
      menuStyle,
      menuClass,
      noData,
      children,
      isAppendToBody,
      openSearch,
      searchNull,
      itemLoading,
    } = this.props;

    const searchData: (DropdownOption<V, Item> | readonly DropdownOption<V, Item>[])[] = [];

    (data || []).forEach(item => {
      if (_.isArray(item)) {
        searchData.push(item.filter(o => this.filterFun(o)));
      } else if (this.filterFun(item)) {
        searchData.push(item);
      }
    });

    if (!showMenu) return <div />;

    return (
      <Menu
        className={menuClass}
        isAppendToBody={isAppendToBody}
        parentMenuItem={this}
        style={{
          maxHeight: maxHeight || 300,
          overflowY: 'auto',
          overflowX: 'hidden',
          ...this.getInputWidth(),
          ...menuStyle,
        }}
        onClickAway={() => {
          this.setState({
            showMenu: false,
          });
          this.props.onVisibleChange(false);
        }}
        onClickAwayExceptions={[this._input]}
        fixedHeader={
          openSearch &&
          (!!data.length || this.props.onSearch) && (
            <div
              className="flexRow"
              style={{
                padding: '0 var(--space-4) 0 14px',
                height: 36,
                alignItems: 'center',
                borderBottom: '1px solid var(--color-border-secondary)',
                marginBottom: 5,
              }}
            >
              <i className="icon-search textSecondary Font14" />
              <input
                name="dropdown"
                autoComplete="off"
                type="text"
                ref={search => {
                  this.search = search;
                }}
                autoFocus
                className="mLeft5 flex Border0 placeholderColor w100"
                placeholder={_l('搜索')}
                onChange={evt =>
                  this.props.onSearch
                    ? this.props.onSearch(evt.target.value.trim())
                    : this.setState({ keywords: evt.target.value.trim() })
                }
              />
            </div>
          )
        }
      >
        {searchData && !this.checkIsNull(searchData) ? (
          this.renderListItem(searchData)
        ) : itemLoading ? (
          <LoadDiv />
        ) : (
          <MenuItem disabled>
            <div>{keywords ? (searchNull ? searchNull() : _l('暂无搜索结果')) : noData}</div>
          </MenuItem>
        )}
        {children}
      </Menu>
    );
  };

  displayPointer = () => {
    const { value } = this.state;
    const { dropIcon, placeholder, data, cancelAble, disabledClickElement, renderPointer } = this.props;
    const selectedData = _.find(_.flatten(data), item => item.value === value);
    return (
      <div
        className={cx('Dropdown--input', { 'Dropdown--border': !!this.props.border }, { active: this.state.showMenu })}
        ref={input => {
          this._input = input;
        }}
        onClick={event => {
          event.stopPropagation();
          if (disabledClickElement) {
            !$(event.target).closest(disabledClickElement).length && this.handleClick();
          } else {
            this.handleClick();
          }
        }}
      >
        {renderPointer ? (
          renderPointer()
        ) : (
          <React.Fragment>
            {value != undefined ? (
              <span
                className={cx('value', {
                  hoverColorPrimary: this.props.hoverTheme,
                  hoverBorderColorPrimary: this.props.hoverTheme,
                })}
              >
                {this.props.renderError && !this.props.data.map(o => (_.isArray(o) ? undefined : o.value)).includes(value)
                  ? this.props.renderError()
                  : this.props.renderTitle
                    ? this.props.renderTitle(selectedData)
                    : this.props.renderValue.replace(
                        /{{value}}/g,
                        // text 可能是节点；replace 本来就会把它转成字符串，这里只是写明
                        String(this.getTextFromDataById(this.props.data, this.state.value)),
                      )}
              </span>
            ) : (
              <span className="Dropdown--placeholder textPlaceholder ellipsis InlineBlock">{placeholder}</span>
            )}
            {cancelAble && value != undefined ? (
              <Fragment>
                <Icon
                  icon="cancel"
                  className="textTertiary mLeft8 clearIcon"
                  onClick={e => {
                    e.stopPropagation();
                    if (value != undefined) {
                      this.setState({
                        value: undefined,
                      });
                    }

                    if (this.props.selectClose) {
                      this.setState({
                        showMenu: false,
                      });
                      this.props.onVisibleChange(false);
                    }

                    if (this.props.onChange) {
                      this.props.onChange(undefined);
                    }
                  }}
                />
                <Icon icon={dropIcon || 'arrow-down-border'} className="textTertiary mLeft8 dropArrow" />
              </Fragment>
            ) : (
              <Icon icon={dropIcon || 'arrow-down-border'} className="mLeft8 textTertiary" />
            )}
          </React.Fragment>
        )}
      </div>
    );
  };

  override render() {
    const { isAppendToBody, className, menuClass, disabled, style, points, offset } = this.props;
    return (
      <div className={`ming Dropdown pointer ${className || ''} ${disabled ? 'disabled' : ''}`} style={style}>
        {isAppendToBody ? (
          <Trigger
            ref={trigger => {
              this.trigger = trigger;
            }}
            action={['click']}
            popup={this.displayMenu()}
            popupClassName={cx('dropdownTrigger', menuClass)}
            popupVisible={this.state.showMenu}
            popupAlign={{
              points: points || ['tl', 'bl'],
              offset: offset || [0, 1],
              overflow: {
                adjustX: true,
                adjustY: true,
              },
            }}
          >
            {this.displayPointer()}
          </Trigger>
        ) : (
          <div>
            {this.displayPointer()}
            {this.displayMenu()}
          </div>
        )}
      </div>
    );
  }
}

export default Dropdown;
