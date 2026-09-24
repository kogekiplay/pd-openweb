import { Component } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { normalizeFileUrl } from 'src/utils/fileUrl';
import './less/Avatar.less';

export interface AvatarProps {
  size?: number | undefined;
  shape?: string | undefined;
  src: string;
  className?: string | undefined;
}

export default class Avatar extends Component<AvatarProps, any> {
  static override propTypes = {
    src: PropTypes.string,
    size: PropTypes.number,
    shape: PropTypes.string,
  };

  static defaultProps = {
    size: 36,
    shape: 'circle',
  };

  constructor(props: AvatarProps) {
    super(props);
  }

  override render() {
    const { src, shape, size, className } = this.props;

    return (
      <span style={{ width: size, height: size }} className={cx('avatarBox', className)}>
        <img
          style={{ width: '100%', height: '100%' }}
          className={`${shape}`}
          /* 头像地址可能是别的服务给的绝对 http 地址（工作流接口就是），
             生产是 https，会被当混合内容拦掉 —— 见 normalizeFileUrl。 */
          src={normalizeFileUrl(src) || `${md.global.FileStoreConfig.pictureHost}/UserAvatar/default.gif`}
          alt="avatar"
        />
      </span>
    );
  }
}
