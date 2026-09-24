import { Component } from 'react';
import { Select } from 'antd';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Icon } from 'ming-ui';

const Tag = styled.div`
  font-size: var(--font-xs);
  background-color: var(--tag-bg);
  border: 1px solid var(--color-border-tertiary);
  padding: 6px 10px;
  border-radius: 12px;
  max-width: 360px;
  height: 24px;
  display: flex;
  align-items: center;
  span {
    color: var(--color-text-primary);
  }
  .remove {
    margin-left: var(--space-2);
  }
`;

const DropdownWrap = styled.div`
  padding: 6px var(--space-3);
`;

export default class Text extends Component<any, any> {
  static override propTypes = {
    disabled: PropTypes.bool,
    values: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func,
  };
  static defaultProps = {
    values: [],
  };
  constructor(props) {
    super(props);
    this.state = {
      searchValue: undefined,
      values: this.props.values || [],
    };
  }

  onSearch = (value: string) => this.setState({ searchValue: value });

  onChange = value => {
    this.props.onChange({ values: value });
    this.setState({ searchValue: undefined, values: value });
  };

  onRemove = tag => {
    const newValues = this.state.values.filter(l => l !== tag.value);
    this.props.onChange({ values: newValues });
    this.setState({ values: newValues });
  };

  onInputKeyDown = e => {
    if (e.key !== 'Enter') return null;

    const { searchValue, values } = this.state;
    const value = _.trim(searchValue);

    if (!value || _.includes(value)) return null;

    this.onChange(values.concat(value));
  };

  tagRender = tag => {
    return (
      <Tag>
        <span className="ellipsis">{tag.value}</span>
        <Icon icon="clear" className="remove textTertiary Hand" onClick={() => this.onRemove(tag)} />
      </Tag>
    );
  };

  dropdownRender = () => {
    const { searchValue } = this.state;

    if (!searchValue) return null;

    return (
      <DropdownWrap className="colorPrimary Font13 Hand">
        {_l('使用')}“{searchValue}”
      </DropdownWrap>
    );
  };

  override render() {
    const { searchValue, values } = this.state;
    const { disabled } = this.props;

    return (
      (<Select
        mode="tags"
        className="worksheetFilterTextCondition"
        placeholder={_l('请输入')}
        classNames={{ popup: { root: cx('worksheetFilterTextPopup', { hide: !searchValue }) } }}
        disabled={disabled}
        value={values}
        style={{ width: '100%' }}
        notFoundContent={null}
        onChange={this.onChange}
        showSearch={{ searchValue: searchValue, onSearch: this.onSearch }}
        tokenSeparators={['\r\n', '\n']}
        options={[]}
        tagRender={this.tagRender}
        popupRender={this.dropdownRender}
        onInputKeyDown={this.onInputKeyDown}
      />)
    );
  }
}
