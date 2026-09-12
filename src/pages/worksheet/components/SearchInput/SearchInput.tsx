import React, { Component } from 'react';
import { shallowEqual } from 'react-redux';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { Tooltip } from 'ming-ui/antd-components';
import { browserIsMobile } from 'src/utils/common';
import './SearchInput.less';

export default class SearchInput extends Component<any, any> {
  static propTypes = {
    active: PropTypes.bool,
    className: PropTypes.string,
    focusedClass: PropTypes.string,
    style: PropTypes.shape({}),
    placeholder: PropTypes.string,
    showCaseSensitive: PropTypes.bool,
    onClear: PropTypes.func,
    onOk: PropTypes.func,
    onFocus: PropTypes.func,
    onBlur: PropTypes.func,
  };
  static defaultProps = {
    style: {},
    onClear: () => {},
    onFocus: () => {},
    onBlur: () => {},
  };
  constructor(props) {
    super(props);
    this.state = {
      isFocus: false,
      isCaseSensitive: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (!shallowEqual(prevProps, this.props)) {
      if (typeof this.props.active !== 'undefined') {
        this.setState({
          isFocus: this.props.active,
        });
      }

      if (prevProps.viewId !== this.props.viewId) {
        this.setState({
          value: '',
          isFocus: false,
        });
      }
    }
  }
  clear() {
    this.setState({ value: '' });
  }
  render() {
    const { inputWidth, focusedClass, style, searchIcon, showCaseSensitive } = this.props;
    const { value, isFocus, isCaseSensitive } = this.state;
    const { className, keyWords, onOk, onClear, onFocus, onBlur, placeholder, triggerWhenBlurWithEmpty } = this.props;
    const focusMode = isFocus || isCaseSensitive;

    const handleIconClick = () => {
      this.setState({ isFocus: true }, () => {
        $(this.inputEl).focus();
      });
    };

    const iconNode =
      !isFocus && searchIcon ? (
        <span onClick={handleIconClick}>{searchIcon}</span>
      ) : (
        <i className="icon icon-search textTertiary" onClick={handleIconClick} />
      );
    return (
      <div
        className={cx(
          'searchInputComp',
          className,
          { default: !focusMode, flex: focusMode && browserIsMobile() },
          focusMode ? focusedClass : '',
        )}
        style={style}
      >
        <div className="inputCon">
          {isFocus ? (
            iconNode
          ) : (
            <Tooltip placement="bottom" title={<span>{placeholder || _l('搜索')}</span>}>
              {iconNode}
            </Tooltip>
          )}
          {focusMode && (
            <input
              className={cx({ flex: browserIsMobile() })}
              ref={inputEl => {
                this.inputEl = inputEl;
              }}
              placeholder={placeholder || _l('搜索')}
              type={browserIsMobile() ? 'search' : 'text'}
              // name 给浏览器认字段（缺了会报 "A form field element should have an id or
              // name attribute"）；autoComplete="off" 必须同时加——此前没有 name，
              // 浏览器从没存过历史值，只补 name 会开始弹自动填充下拉框盖住搜索结果。
              name="worksheetSearch"
              autoComplete="off"
              value={value}
              style={isFocus && inputWidth ? { width: inputWidth } : {}}
              onKeyUp={e => {
                if (e.keyCode === 13) {
                  onOk(e.target.value, { isCaseSensitive });
                }
              }}
              onChange={e => {
                this.setState({ value: e.target.value });
              }}
              onFocus={() => {
                this.setState({ isFocus: true });
                onFocus();
              }}
              onBlur={e => {
                if (!value && !keyWords) {
                  this.setState({ isFocus: false });
                  onBlur();
                }

                if (triggerWhenBlurWithEmpty && e.target.value === '' && keyWords) {
                  onOk('');
                }
              }}
            />
          )}
          <i
            className={cx('icon icon-cancel Hand textTertiary', {
              none: !value,
            })}
            onClick={() => {
              this.setState({ value: '', isFocus: false }, () => {
                onClear();
              });
            }}
          />
          {showCaseSensitive && (
            <Tooltip title={isCaseSensitive ? _l('取消区分大小写') : _l('区分大小写')} placement="bottom">
              <div
                className={cx('caseSensitive', { colorPrimary: isCaseSensitive })}
                onMouseDown={() => {
                  this.setState({ isCaseSensitive: !isCaseSensitive });
                  onOk(value, { isCaseSensitive: !isCaseSensitive });
                }}
              >
                <i className="icon icon-case"></i>
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }
}
