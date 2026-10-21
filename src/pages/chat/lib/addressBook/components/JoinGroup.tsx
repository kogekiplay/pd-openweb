import React from 'react';
import Button from 'ming-ui/components/Button';
import Icon from 'ming-ui/components/Icon';
import { joinGroup } from '../api';

/** 需申请加入的群组提示（父级传 groupId） */
interface JoinGroupProps {
  groupId?: string | undefined;
}

export default class JoinGroup extends React.Component<JoinGroupProps> {
  override render() {
    const { groupId } = this.props;
    return (
      <div className="contacts-add-friend">
        <Icon icon={'error1'} className="contacts-add-friend-icon" />
        <div className="Font16 mBottom25">{_l('此群组需加入后才可访问')}</div>
        {/* 擦除标记：父级只在拿到群 id 时渲染本组件（原 any 直接透传）。 */}
        <Button type="primary" size="medium" action={() => joinGroup(groupId as string)}>
          {_l('申请加入此群组')}
        </Button>
      </div>
    );
  }
}
