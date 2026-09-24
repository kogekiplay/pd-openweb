import React, { useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import styled from 'styled-components';
import { browserIsMobile } from 'src/utils/common';
import GroupCon from './GroupCon';
import type { FormControl } from 'src/utils/controlTypes';

const Wrap = styled.div`
  width: ${props => (!props.width ? '100%' : props.width + 'px')};
  height: 100%;
  border-right: 2px solid var(--color-border-primary);
  background-color: var(--color-background-primary);
  flex-shrink: 0;
  .dataCon {
    .searchBar {
      height: 44px;
      min-height: 44px;
      width: 100%;
      padding: 0 var(--space-3);
      .icon {
        line-height: 35px;
        font-size: var(--font-2xl);
        color: var(--color-text-disabled);
        &.icon-close {
          cursor: pointer;
        }
        &.icon-search {
          &:hover {
            color: var(--color-text-disabled);
          }
        }
        &:hover {
          color: var(--color-primary);
        }
      }
      input {
        width: 100%;
        height: 36px;
        border: none;
        padding-left: 6px;
        font-size: var(--font-sm);
      }
    }
  }
  &.mobileResourceViewLeftCon {
    width: auto;
    max-width: 30%;
  }
`;

export default function DataCon(props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = browserIsMobile();

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 200);
  });

  const renderContent = () => {
    const { resourceview, updateKeyWords, view, controls }: { controls: FormControl[]; [key: string]: any } = props;
    const { keywords } = resourceview;
    const { viewControl } = view;
    const str = (controls.find((o: FormControl) => o.controlId === viewControl) || {}).controlName;
    return (
      <div className="dataCon flexColumn h100">
        {isMobile ? (
          <div className="searchBar"></div>
        ) : (
          <div className={cx('searchBar flexRow', {})}>
            <React.Fragment>
              <i className="icon icon-search"></i>
              <input
                name="resourceViewDataCon"
                autoComplete="off"
                type="text"
                placeholder={_l('搜索%0', str)}
                ref={inputRef}
                className={cx('flex', { placeholderColor: !keywords })}
                value={keywords}
                onChange={e => updateKeyWords(e.target.value)}
              />
            </React.Fragment>
            {keywords && (
              <i
                className="icon icon-cancel Hand"
                onClick={() => {
                  updateKeyWords('');
                }}
              ></i>
            )}
          </div>
        )}
        <GroupCon {...props} />
      </div>
    );
  };

  return (
    <Wrap width={props.directoryWidth} className={cx('resourceViewLeftCon', { mobileResourceViewLeftCon: isMobile })}>
      {!loading &&
        (_.get(props, 'resourceview.loading') && props.renderLoading ? props.renderLoading() : renderContent())}
    </Wrap>
  );
}
