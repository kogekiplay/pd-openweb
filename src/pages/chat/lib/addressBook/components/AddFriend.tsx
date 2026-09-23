import React from 'react';
import { Button, Icon } from 'ming-ui';
import { addFriendConfirm } from 'ming-ui/functions';

interface AddFriendProps {
  accountId?: string;
  [key: string]: unknown;
}

export default class AddFriend extends React.Component<AddFriendProps> {
  override render() {
    return (
      <div className="contacts-add-friend">
        <Icon icon={'error1'} className="contacts-add-friend-icon" />
        <div className="Font16 mBottom25">{_l('对方不是您的联系人，无法查看')}</div>
        <Button
          type="primary"
          size="medium"
          onClick={() => {
            addFriendConfirm({
              accountId: this.props.accountId,
            });
          }}
        >
          {_l('加为好友')}
        </Button>
      </div>
    );
  }
}
