import React from 'react';
import Icon from 'ming-ui/components/Icon';
import inboxController from 'src/api/inbox';
import { browserIsMobile } from 'src/utils/common';
import type { InboxMessageBody } from '../../payloadTypes';

/** `Star` 的 props（父级透传收件箱条目的星标与 id） */
interface StarProps {
  /** 后端给字符串 '0'/'1'（渲染处按 === '1' 判断） */
  isFavorite?: InboxMessageBody['isFavorite'];
  inboxId?: string | number | undefined;
}

interface StarState {
  isFavorite?: InboxMessageBody['isFavorite'];
}

export default class Star extends React.Component<StarProps, StarState> {
  constructor(props: StarProps) {
    super(props);
    this.state = {
      isFavorite: props.isFavorite,
    };
    this.clickHandler = this.clickHandler.bind(this);
  }

  clickHandler(flag: NonNullable<InboxMessageBody['isFavorite']>) {
    const { inboxId } = this.props;

    return () => {
      inboxController
        .setInboxFavorite({
          inboxId,
          inboxFavorite: flag,
        })
        .then(res => {
          if (res) {
            this.setState(
              {
                isFavorite: flag,
              },
              function () {
                alert(_l('操作成功'));
              },
            );
          } else {
            alert(_l('操作失败'), 2);
          }
        });
    };
  }
  override render() {
    const { isFavorite } = this.state;

    if (md.global.Account.isPortal && browserIsMobile()) {
      return null;
    }

    return (
      <div className="Right">
        {isFavorite === '1' ? (
          <Icon
            icon="task-star"
            className="Font18 Hand"
            hint={_l('取消加星')}
            onClick={this.clickHandler('0')}
            style={{ color: '#fbc02d' }}
          />
        ) : (
          <Icon
            icon="star-hollow"
            className="Font18 Hand hoverColorPrimary"
            style={{ color: 'var(--color-border-tertiary)' }}
            hint={_l('加星')}
            onClick={this.clickHandler('1')}
          />
        )}
      </div>
    );
  }
}
