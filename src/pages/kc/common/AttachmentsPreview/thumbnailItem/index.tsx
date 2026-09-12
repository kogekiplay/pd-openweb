import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { getFileIconNameByExt } from '../../../utils';
import { PREVIEW_TYPE } from '../constant/enum';

const typeColors = {
  '7z': '#FBC02d',
  ai: '#ff9100',
  cal: '#9c27b0',
  doc: '#acacac',
  excel: 'var(--color-success)',
  img: '#ff5252',
  mmap: '#d32f2f',
  pdf: '#d32f2f',
  ppt: '#f57c00',
  psd: '#536dfe',
  rar: '#fbc02d',
  txt: '#1de9b6',
  vsd: '#c2185b',
  word: '#448aff',
  xmind: '#d32f2f',
  zip: '#fbc02d',
  link: '#00bcd4',
};

class ThumbnailItem extends React.Component<any, any> {
  static propTypes = {
    attachment: PropTypes.object,
    current: PropTypes.bool,
    onClick: PropTypes.func,
  };

  state = {
    error: false,
  };

  render() {
    const MAX_IMG_VIEW_SIZE = 20971520;
    const attachment = this.props.attachment;
    const { previewType, size, name } = attachment;
    const ext = attachment.ext.toLowerCase();
    let content;

    if (
      previewType === PREVIEW_TYPE.PICTURE &&
      size < MAX_IMG_VIEW_SIZE &&
      !this.state.error &&
      (!attachment.refId || attachment.shareUrl)
    ) {
      let imagePath = attachment.viewUrl || '';

      if (imagePath) {
        // 原来这里是 `const urlObj = new URL(imagePath); urlObj.search ? '&…' : '?…'`。
        // 私有部署下 attachment.viewUrl 是【根相对路径】（实测形如
        // /file/mdpic/<projectId>/<appId>/<recordId>/20260912/xxx.png?e=178926328），
        // 而 new URL(相对路径) 不带 base 会直接抛 TypeError: Invalid URL。
        // 抛在 render 里 → 整个 AttachmentsPreview 挂不上 → 表现就是「附件预览点不开」：
        // 没有弹层、没有 ErrorBoundary 兜底页，只有控制台一条 Invalid URL。
        // 而且只在【图片类】附件上触发（要 previewType === PICTURE 才走到这一行），
        // 所以同一条记录里点 mp4 没事、点 png 就哑掉，很容易以为是文件本身的问题。
        // SaaS 上 viewUrl 是绝对地址，所以上游一直没暴露。
        // 这里本来就只想知道「有没有 query」，不需要解析整个 URL，看有没有 ? 即可 ——
        // 绝对地址、根相对、协议相对（//host/…）三种都对。
        imagePath += imagePath.includes('?') ? `&imageView2/2/h/70` : `?imageView2/2/h/70`;
      }

      content = (
        <img
          onError={() => {
            this.setState({
              error: true,
            });
          }}
          onContextMenu={e => e.preventDefault()}
          src={imagePath}
          alt=""
        />
      );
    } else {
      const bgColor = typeColors[getFileIconNameByExt(ext)] || 'var(--color-text-tertiary)';
      content = (
        <span className="typeBlock" style={{ backgroundColor: bgColor }}>
          <span className="fileName">{name.length > 10 ? name.slice(0, 10) + '...' : name}</span>
          <span className="extName ellipsis">{ext.toUpperCase()}</span>
        </span>
      );
    }

    return (
      <div
        onClick={this.props.onClick}
        className={cx('thumbnailItem', {
          current: this.props.current,
        })}
      >
        {content}
      </div>
    );
  }
}

export default ThumbnailItem;
