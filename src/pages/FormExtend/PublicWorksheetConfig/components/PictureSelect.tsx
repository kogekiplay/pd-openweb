import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const PicList = styled.div`
  margin-top: 10px;
  height: 146px;
`;
const Pic = styled.div`
  cursor: pointer;
  position: relative;
  width: 90px;
  height: 70px;
  display: inline-block;
  margin-right: 6px;
  background-size: cover !important;
  background-color: rgba(0, 0, 0, 0.4) !important;
  &:nth-child(6n) {
    margin-right: 0px;
  }
  .picMask,
  .icon {
    visibility: hidden;
  }
  &:hover {
    .picMask {
      visibility: visible;
    }
  }
  .active.picMask {
    visibility: visible;
  }
  .active.picMask .icon {
    visibility: visible;
  }
`;
const PicMask = styled.div`
  position: absolute;
  width: 90px;
  height: 70px;
  background-color: rgba(0, 0, 0, 0.2);
  text-align: center;
  line-height: 60px;
  font-size: var(--font-2xl);
  color: var(--color-white);
`;
const Pages = styled.div`
  text-align: center;
  line-height: 0;
  margin-top: 15px;
`;
const PageCon = styled.div`
  cursor: pointer;
  display: inline-block;
  padding: 3px 5px;
`;
const Page = styled.div(
  ({ active }) => `
  width: 8px;
  height: 8px;
  border-radius: 6px;
  background: ${active ? 'var(--color-text-tertiary)' : 'var(--color-border-secondary)'};
  vertical-align: middle;
`,
);

export default class extends React.Component<any, any> {
  static override propTypes = {
    coverUrl: PropTypes.string,
    images: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func,
  };
  constructor(props) {
    super(props);
    this.state = {
      pageIndex: 0,
    };
  }
  override render() {
    const { images, coverUrl = '', onChange = () => {} } = this.props;
    const { pageIndex } = this.state;
    return (
      <div>
        <PicList>
          {images.slice(pageIndex * 12, (pageIndex + 1) * 12).map((url, index) => (
            <Pic
              key={index}
              onClick={() => onChange(`${md.global.FileStoreConfig.pubHost}/${url}`)}
              style={{ background: `url(${md.global.FileStoreConfig.pubHost}/${url}?imageView2/1/w/160)` }}
            >
              <PicMask
                className={cx('picMask', {
                  active: `${md.global.FileStoreConfig.pubHost}/${url}` === coverUrl.split('?')[0],
                })}
              >
                <i className="icon icon-hr_ok"></i>
              </PicMask>
            </Pic>
          ))}
        </PicList>
        <Pages>
          {[...new Array(Math.ceil(images.length / 12))].map((_a, i) => (
            <PageCon
              key={i}
              onClick={() => {
                this.setState({ pageIndex: i });
              }}
            >
              <Page active={i === pageIndex} />
            </PageCon>
          ))}
        </Pages>
      </div>
    );
  }
}
