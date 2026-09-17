import React, { Component } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { normalizeFileUrl } from 'src/utils/fileUrl';
import './less/Avatar.less';

export default class Avatar extends Component<any, any> {
  static propTypes = {
    src: PropTypes.string,
    size: PropTypes.number,
    shape: PropTypes.string,
  };

  static defaultProps = {
    size: 36,
    shape: 'circle',
  };

  constructor(props) {
    super(props);
  }

  render() {
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
