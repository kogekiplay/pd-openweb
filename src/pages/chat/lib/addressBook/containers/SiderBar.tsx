import React from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import { Button, Icon, ScrollView } from 'ming-ui';
import addFriends from 'src/components/addFriends';
import SiderBarTabItem from '../components/SiderBarTabItem';
import SiderBarTabList from '../components/SiderBarTabList';

/** 左侧分组行：内置分组（`SIDER_BAR_LIST`）与收拢后的项目行两种形态 */
export interface SiderBarRow {
  type?: string | undefined;
  name?: string | undefined;
  projectId?: string | null | undefined;
  /** 分隔线行（没有 type/name） */
  dividor?: boolean | undefined;
  icon?: string | undefined;
  tip?: string | undefined;
  /** 项目行下面的子分组 */
  list?: SiderBarRow[] | undefined;
}

interface SideBarProps {
  type?: string | undefined;
  projectId?: string | null | undefined;
  list?: SiderBarRow[] | undefined;
  updateHighlightTab: (type: string | undefined, projectId: string | null | undefined) => void;
}

export default class SideBar extends React.Component<SideBarProps> {
  static override propTypes = {
    type: PropTypes.string.isRequired,
    projectId: PropTypes.string,

    list: PropTypes.arrayOf(PropTypes.object),

    updateHighlightTab: PropTypes.func.isRequired,
  };

  getOpenState(list: SiderBarRow[] | undefined, projectId?: string | null, type?: string) {
    return !!_.find(list, item => {
      if (projectId) {
        return item.projectId === projectId && item.type === type;
      } else {
        return item.type === type;
      }
    });
  }

  renderItem(item: SiderBarRow, index: number) {
    const { type, projectId, updateHighlightTab } = this.props;
    const isProject = !!item.projectId;
    const isActive = isProject ? type === item.type && projectId === item.projectId : type === item.type;
    const props = {
      ...item,
      key: index,
      isActive,
      clickHandler: () => {
        // 擦除标记：分组行必带 type/projectId（原 any 直接透传；缺省时父级同样收到 undefined）。
        updateHighlightTab(item.type, item.projectId);
      },
    };
    return <SiderBarTabItem {...props} />;
  }

  renderTabs(item: SiderBarRow, index: number) {
    const { type, projectId } = this.props;

    if (item.dividor) {
      return <div className="dividor" key={index} />;
    } else {
      if (item.list) {
        const props = {
          key: index,
          name: item.name,
          projectId: item.projectId,
          isOpen: this.getOpenState(item.list, projectId, type),
        };
        return (
          <SiderBarTabList {...props}>
            {_.map(item.list, (childItem, childIndex) => {
              return this.renderItem(childItem, childIndex);
            })}
          </SiderBarTabList>
        );
      } else {
        return this.renderItem(item, index);
      }
    }
  }

  override render() {
    const { list } = this.props;
    return (
      <div className="contacts-sidebar">
        <div className="Font20 pLeft24 mTop20 mBottom12">{_l('通讯录')}</div>
        <div className="pLeft24 pRight24 mBottom12 Relative">
          <Button
            type="primary"
            style={{ width: '100%' }}
            className="invite-btn"
            onClick={() => {
              addFriends({ selectProject: true });
            }}
          >
            <Icon icon="plus" className="mRight5 TxtMiddle" />
            <span className="TxtMiddle">{_l('添加联系人')}</span>
          </Button>
        </div>
        <div className="contacts-tabs minHeight0">
          <ScrollView>
            {_.map(list, (item, index) => {
              return this.renderTabs(item, index);
            })}
          </ScrollView>
        </div>
      </div>
    );
  }
}
