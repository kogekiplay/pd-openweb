import React from 'react';
import { UserCard } from 'ming-ui';

export default class UserLink extends React.Component<any, any> {
  declare card: HTMLAnchorElement | null | undefined;

  constructor(props) {
    super(props);
    this.state = {
      ...props,
    };
  }

  override render() {
    const { accountId, fullname } = this.props;

    return (
      <UserCard sourceId={accountId}>
        <a
          ref={elem => {
            this.card = elem;
          }}
        >
          {fullname}
        </a>
      </UserCard>
    );
  }
}
