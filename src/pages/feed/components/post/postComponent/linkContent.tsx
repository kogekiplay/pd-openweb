import React from 'react';
import PropTypes from 'prop-types';
import { htmlDecodeReg } from 'src/utils/common';

/**
 * 链接型动态所带的链接和图片
 */
/** 形状与下面的 propTypes 一致 */
interface LinkItem {
  linkUrl: string;
  linkTitle: string;
  linkDesc?: string;
  flashUrl?: string;
  linkThumb?: string;
}

interface LinkContentProps {
  linkItem: LinkItem;
  [key: string]: unknown;
}

class LinkContent extends React.Component<LinkContentProps> {
  static override propTypes = {
    linkItem: PropTypes.shape({
      linkUrl: PropTypes.string.isRequired,
      linkTitle: PropTypes.string.isRequired,
      linkDesc: PropTypes.string,
      flashUrl: PropTypes.string,
      linkThumb: PropTypes.string,
    }),
  };

  override render() {
    const linkItem = this.props.linkItem;

    return (
      <div className="linkContent">
        <a target="_blank" rel="noopener noreferrer" href={linkItem.linkUrl}>
          {htmlDecodeReg(linkItem.linkTitle || _l('链接'))}
        </a>
        {(() => {
          if (linkItem.linkThumb) {
            return (
              <div className="mTop5">
                <img className="lazy" alt={linkItem.linkTitle} src={linkItem.linkThumb} />
              </div>
            );
          }
          return undefined;
        })()}
        {linkItem.linkDesc && <div className="textPrimary mTop5">{linkItem.linkDesc.toLowerCase()}</div>}
      </div>
    );
  }
}

export default LinkContent;
