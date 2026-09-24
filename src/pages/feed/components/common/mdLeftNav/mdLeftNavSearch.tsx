import React from 'react';
import PropTypes from 'prop-types';
import './mdLeftNavSearch.css';

class MDLeftNavSearch extends React.Component<any, any> {
  declare root: HTMLDivElement | null | undefined;

  static override propTypes = {
    value: PropTypes.string,
    onSearch: PropTypes.func,
    onChange: PropTypes.func,
  };
  /* defaultValue 从 propTypes 里去掉了：下面的 <input> 写死了 value={value || ''}，
     受控组件根本不可能兑现一个初始值，留着只会引人去传、然后撞上
     「同时有 value 和 defaultValue」的警告。 */

  handleKeyUp = evt => {
    if (evt.which === 13 && this.props.onSearch) {
      this.props.onSearch(evt.target.value);
    }
  };

  handleFocus = () => {
    $(this.root).addClass('borderColorPrimary').removeClass('borderSecondary');
  };

  handleBlur = () => {
    $(this.root).removeClass('borderColorPrimary').addClass('borderSecondary');
  };

  override render() {
    /* onSearch / defaultValue 是本组件自己的 props，不能跟着 ...props 落到 <input> 上。
       原先只摘了 value，于是 onSearch 透传到 DOM，控制台每次挂载都报
       "Unknown event handler property `onSearch`. It will be ignored."
       —— React 对 on+大写开头但不是已知 DOM 事件的属性一律这么报。
       onChange 是真的 DOM 事件，继续透传。 */
    const { value, onSearch, defaultValue, ...props } = this.props;

    return (
      <div className="mdLeftNavSearch borderSecondary" ref={root => { this.root = root; }}>
        <span className="icon-search btnSearch textSecondary" title={_l('搜索')} />
        <input
          name="mdLeftNavMdLeftNavSearch"
          autoComplete="off"
          {...props}
          value={value || ''}
          onKeyUp={this.handleKeyUp}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          type="text"
          className="searchBox textPrimary"
          placeholder={_l('搜索')}
        />
      </div>
    );
  }
}

export default MDLeftNavSearch;
