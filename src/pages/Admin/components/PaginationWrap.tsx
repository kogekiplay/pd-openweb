import React, { Component } from 'react';
import { Pagination } from 'antd';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const Wrap = styled.div`
  display: flex;
  justify-content: center;
  min-height: 0;
  .ant-pagination {
    padding: var(--space-3);
    .ant-pagination-options {
      display: none;
    }
    .ant-pagination-item {
      height: unset;
      line-height: unset;
      margin-right: 10px;
      min-width: 0;
      border: 1px solid transparent;
      a {
        color: var(--color-text-title);
        display: inline-block;
        padding: 3px var(--space-2);
        text-align: center;
        vertical-align: middle;
        border: 1px solid transparent;
        font-size: var(--font-sm);
        border-radius: var(--radius-sm);
      }
      a:hover {
        background-color: var(--color-background-hover);
        border: 1px solid var(--color-background-secondary);
        color: var(--color-text-title);
      }
    }
    .ant-pagination-item-active {
      border: 1px solid transparent;
      color: var(--color-text-title);
      a {
        text-decoration: none;
        /* 当前页的高亮属于品牌色 —— --color-link 是写死的蓝，不跟主题 */
        color: var(--color-primary-text);
        font-weight: 600;
        border: 1px solid var(--color-primary) !important;
        &:hover {
          background-color: var(--color-background-primary);
        }
      }
    }
    .ant-pagination-prev,
    .ant-pagination-next {
      a {
        color: var(--color-text-title);
        &:hover {
          color: var(--color-link);
        }
      }
      a[disabled] {
        color: rgba(0, 0, 0, 0.25);
        cursor: not-allowed;
      }
    }
  }
`;

export default class PaginationWrap extends Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {};
  }

  itemRender(current, type, originalElement) {
    if (type === 'prev') {
      return <a className="page">{_l('上一页')}</a>;
    }

    if (type === 'next') {
      return <a className="page">{_l('下一页')}</a>;
    }

    return originalElement;
  }

  render() {
    const { className, total, pageSize, pageIndex, onChange = () => {} } = this.props;
    return (
      <Wrap className={className}>
        <Pagination
          total={total}
          pageSize={pageSize || 50}
          current={pageIndex || 1}
          hideOnSinglePage={true}
          itemRender={this.itemRender}
          onChange={onChange}
          {...this.props}
        />
      </Wrap>
    );
  }
}

PaginationWrap.propTypes = {
  count: PropTypes.number,
  pageSize: PropTypes.number,
  pageIndex: PropTypes.number,
  onChange: PropTypes.func,
};
