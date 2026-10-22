import React from 'react';
import { UserCard } from 'ming-ui';

interface UserLinkProps {
  accountId?: string | undefined;
  fullname?: string | undefined;
}

export default class UserLink extends React.Component<UserLinkProps> {
  declare card: HTMLAnchorElement | null | undefined;

  constructor(props: UserLinkProps) {
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
