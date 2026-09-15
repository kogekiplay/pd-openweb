import React, { Component } from 'react';
import { Menu } from 'antd';
import cx from 'classnames';
import { Icon } from 'ming-ui';
import { VIEW_TYPE_ICON } from 'src/pages/worksheet/constants/enum.js';

export default class ViewDisplayMenu extends Component<any, any> {
  static propTypes = {};
  static defaultProps = {};
  state = {};
  render() {
    const { onClick, viewType, ...rest } = this.props;
    return (
      // antd 5 起 Menu 的 children 写法已弃用（控制台报 `children` is deprecated，
      // 请改用 items）。改成 items 后 DOM 结构不变：Menu.Item 本来就渲染成
      // <li class="ant-menu-item"><span class="ant-menu-title-content">{内容}</span></li>，
      // 原来的多个子节点用 Fragment 包起来即可，不引入额外节点，样式选择器不受影响。
      //
      // className / onClick / data-* 这三样【都能继续用】—— antd 文档的 MenuItemType
      // 表格只列了它自己新增的字段（danger/icon/title 等），看着像不支持；
      // 实际 MenuItemType extends RcMenuItemType extends ItemSharedProps，
      // className 和 onClick 都在里面（@rc-component/menu es/interface.d.ts:6 和 :38），
      // data-* 则由 antd 的 DataAttributes 提供（antd/es/menu/interface.d.ts:16）。
      <Menu
        className="viewTypeMenuWrap"
        {...rest}
        items={VIEW_TYPE_ICON.filter(o => o.id !== 'customize').map(({ icon, text, id, color, isNew }) => ({
          key: id,
          'data-event': id,
          className: cx('viewTypeItem', { current: viewType === id }),
          onClick: () => onClick(id),
          label: (
            <React.Fragment>
              <div className="valignWrapper flex">
                <Icon style={{ color, fontSize: '18px' }} icon={icon} />
                <span className="viewName">{text}</span>
              </div>
              {viewType === id && <Icon icon="done" className="mRight12" />}
              {isNew && (
                <div className="newIcon">
                  <Icon icon="new" className="colorPrimary Font20" />
                </div>
              )}
            </React.Fragment>
          ),
        }))}
      />
    );
  }
}
