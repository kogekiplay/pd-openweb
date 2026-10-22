import React from 'react';
import { Icon, ScrollView } from 'ming-ui';
import settingGroup from 'src/pages/Group/settingGroup';
import { closeGroup, openGroup } from '../api';
import { config } from '../config';
import type { AddressBookGroupDetail, AddressBookSettingResult, AddressBookGroupPatch } from '../types';
import { pathCompletion } from 'src/utils/common';

interface GroupDetailProps {
  group?: AddressBookGroupDetail | undefined;
  /** 当前群状态（1 = 已删除，用于 CLOSE_GROUP 分支） */
  groupStatus?: number | undefined;
  /** 用局部补丁更新父级的群信息（父级方法要求字符串 groupId） */
  updateGroupModel: (groupId: string, patch: AddressBookGroupPatch) => void;
}

export default class GroupDetail extends React.Component<GroupDetailProps> {
  constructor(props: GroupDetailProps) {
    super(props);

    this.openSettingDialog = this.openSettingDialog.bind(this);
  }

  openSettingDialog() {
    // 擦除标记：`render` 已保证 group 存在（原 any 直接解构）。
    const {
      group: { groupId, groupMemberCount },
      groupStatus,
      updateGroupModel,
    } = this.props as { group: AddressBookGroupDetail; groupStatus?: number; updateGroupModel: GroupDetailProps['updateGroupModel'] };
    settingGroup({
      groupID: groupId,
      success: (type: string | undefined, groupInfo: AddressBookSettingResult) => {
        const acceptedTypes: readonly (string | undefined)[] = [
            'UPDATE_AVATAR',
            'RENAME',
            'ADD_MEMBERS',
            'REMOVE_USER',
            'VERIFY',
            'APPROVE',
            'CLOSE_GROUP',
            'DELETE',
            'EXIT_GROUP',
          ];
        if (!acceptedTypes.includes(type)) return;

        let newInfo: AddressBookGroupPatch = {};

        switch (type) {
          case 'UPDATE_AVATAR':
            newInfo.avatar = groupInfo.groupAvatar;
            break;
          case 'RENAME':
            newInfo.name = groupInfo.groupName;
            break;
          case 'ADD_MEMBERS':
          case 'REMOVE_USER':
            // 擦除标记：群成员数由后端给出（原 any 直接运算）；缺省时原实现算 NaN/抛原生 TypeError。
            newInfo.groupMemberCount =
              type === 'REMOVE_USER'
                ? Math.max(0, (groupMemberCount as number) - 1)
                : (groupMemberCount as number) + (groupInfo.accounts as unknown[]).length;
            break;
          case 'CLOSE_GROUP':
            newInfo.isOpen = false;
            newInfo.isDelete = groupStatus === 1;
            break;
          case 'DELETE':
          case 'EXIT_GROUP':
            newInfo.isDelete = true;
            break;
          default:
            newInfo = { ...groupInfo };
            break;
        }

        updateGroupModel(groupId as string, newInfo);
      },
    });
  }

  renderHeader() {
    const {
      group: { avatar, name, groupId, isOpen },
    } = this.props as { group: AddressBookGroupDetail };
    return (
      <React.Fragment>
        {isOpen === false ? (
          <div className="detail-header">
            <img src={avatar as string} className="detail-header-avatar disabled" />
            <div className="detail-header-info textDisabled">
              <div className="Font18 clearfix">{name}</div>
            </div>
          </div>
        ) : (
          <div className="detail-header">
            <img src={avatar as string} className="detail-header-avatar" />
            <div className="detail-header-info">
              <div className="Font18 clearfix">
                {name}
                <i
                  className="Font16 textTertiary icon-settings TxtMiddle mLeft10 Hand hoverColorPrimary"
                  onClick={this.openSettingDialog}
                />
              </div>
            </div>
          </div>
        )}
        {isOpen === false ? null : (
          <div className="detail-btns mTop24">
            <a
              href="javascript:void 0;"
              className="detail-btn bgColorPrimary hoverBgColorPrimaryDark NoUnderline"
              onClick={() => {
                config.callback!({ groupId });
              }}
            >
              <Icon icon="chat" className="mRight5 Font18" />
              {_l('发消息')}
            </a>
            <a
              href={pathCompletion('/feed?groupId=' + groupId)}
              target="_blank"
              className="detail-btn textSecondary mLeft10 NoUnderline"
            >
              <Icon icon="dynamic-empty" className="mRight10 Font17" />
              {_l('群组动态')}
            </a>
          </div>
        )}
      </React.Fragment>
    );
  }

  openGroup() {
    const {
      group: { groupId },
      updateGroupModel,
    } = this.props as { group: AddressBookGroupDetail; updateGroupModel: GroupDetailProps['updateGroupModel'] };
    // 擦除标记：群详情必带 groupId（原 any 直接传）。
    openGroup(groupId as string).then(result => {
      if (result) {
        updateGroupModel(groupId as string, { isOpen: true });
      } else {
        alert(_l('操作失败，请重新尝试'), 2);
      }
    });
  }

  closeGroup() {
    const {
      group: { groupId },
      updateGroupModel,
    } = this.props as { group: AddressBookGroupDetail; updateGroupModel: GroupDetailProps['updateGroupModel'] };
    // 擦除标记：同上。
    closeGroup(groupId as string).then(result => {
      if (result) {
        updateGroupModel(groupId as string, { isOpen: false });
      } else {
        alert(_l('操作失败，请重新尝试'), 2);
      }
    });
  }

  renderDetail() {
    const {
      group: { groupMemberCount, createTime, isOpen, createAccount },
    } = this.props as { group: AddressBookGroupDetail };
    return (
      <div className="Font13 mTop24">
        <div className="detail-info-row">
          <span className="textSecondary">{_l('创建人')}：</span>
          {/* 擦除标记：群详情必带创建者（原 any 直接读）；缺省时原实现抛原生 TypeError。 */}
          {createAccount!.fullname}
        </div>
        <div className="detail-info-row clearfix">
          <span className="textSecondary">{_l('群组状态')}：</span>
          {isOpen === false ? _l('关闭') : _l('开启')}
          {isOpen === false ? (
            <span
              className="hoverColorPrimary Right Hand"
              onClick={() => {
                this.openGroup();
              }}
            >
              {_l('开启')}
            </span>
          ) : null}
        </div>
        <div className="detail-info-row">
          <span className="textSecondary">{_l('群组成员')}：</span>
          {groupMemberCount}
        </div>
        <div className="detail-info-row">
          <span className="textSecondary">{_l('创建时间')}：</span>
          {createTime}
        </div>
      </div>
    );
  }

  override render(): React.ReactNode {
    if (!this.props.group) return null;
    return (
      <ScrollView>
        <div className="contacts-detail-wrapper">
          {this.renderHeader()}
          {this.renderDetail()}
        </div>
      </ScrollView>
    );
  }
}
