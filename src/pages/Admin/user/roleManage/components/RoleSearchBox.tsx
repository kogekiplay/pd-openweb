import { Component } from 'react';
import _ from 'lodash';
import { Icon } from 'ming-ui';

export interface RoleSearchBoxState {
  searchValue: string;
  isSearching: boolean;
}

export default class RoleSearchBox extends Component<any, RoleSearchBoxState> {
  declare input: HTMLInputElement | null | undefined;

  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
      isSearching: false,
    };
    this.ajaxObj = null;
  }
  handleFocus = () => {};
  handleBlur = () => {};
  handChange = _.debounce(value => {
    this.props.updateSearchValue(value);
    if (!value) {
      this.handleClear();
    } else {
      this.props.updateIsRequestList(true);
      this.props.handleSearch(value);
    }
  }, 500);
  handleClear = () => {
    this.setState({ searchValue: '' });
    this.props.updateSearchValue('');
    this.props.updateIsRequestList(true);
    this.props.handleClear();
  };

  override render() {
    const { searchValue } = this.state;
    return (
      <div className="searchContainer Relative">
        <Icon icon="search" className=" btnSearch textSecondary Font18" />
        <input
          name="roleSearchBox"
          autoComplete="off"
          ref={input => { this.input = input; }}
          onChange={e => {
            this.props.updateIsRequestList(false);
            /* 存原始输入，只在发起搜索时 trim。原先这里存的是 trim 过的值、又写回受控的 value，
               于是打不出空格：输入到「项目 」那一刻尾部空格被剪掉，接着打「经理」就成了「项目经理」。
               （原先还同时写了 defaultValue，受控 / 非受控混用，React 每次渲染都警告） */
            this.setState({ searchValue: e.target.value });
            if (this.ajaxObj && this.ajaxObj.abort) {
              this.ajaxObj.abort();
              this.ajaxObj = null;
            }

            this.handChange(e.target.value.trim());
          }}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          type="text"
          className="searchInput textPrimary w100"
          placeholder={_l('搜索')}
          value={searchValue}
        />
        {searchValue !== '' ? (
          <span
            className="Font14 icon-cancel textPlaceholder Hand Absolute"
            style={{
              top: '8px',
              right: '8px',
            }}
            onClick={this.handleClear}
          />
        ) : null}
      </div>
    );
  }
}
