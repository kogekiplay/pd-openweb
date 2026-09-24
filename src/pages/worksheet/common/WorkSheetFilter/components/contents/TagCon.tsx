import { useRef } from 'react';
import cx from 'classnames';
import _ from 'lodash';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { Input } from 'ming-ui';

const InputWrap = styled.span`
  position: relative;
  max-width: 100%;
  display: inline-block;
  input {
    border: none !important;
  }
`;

function TagCon(props) {
  const { disabled, data, renderItem, onRemove, needInput = false, search, onChangeInput = () => {} } = props;
  const inputRef = useRef(null);

  const onFetchData = _.debounce(value => {
    onChangeInput({ keywords: value });
  }, 500);

  return (
    <div className={cx('filterTagCon', { disabled })} onClick={() => inputRef.current?.focus()}>
      {data.length
        ? data.map((item, index: number) => (
            <span className="fiterTagItem" key={index}>
              {renderItem ? renderItem(item) : <span className="text breakAll">{item.name}</span>}
              <span
                className="remove"
                onClick={e => {
                  e.stopPropagation();
                  if (disabled) {
                    return;
                  }

                  onRemove(item);
                }}
              >
                <i className="icon icon-delete"></i>
              </span>
            </span>
          ))
        : null}
      {needInput && !disabled && (
        <InputWrap className="CityPicker-input-tagSearchBox">
          <Input
            manualRef={inputRef}
            placeholder={data.length ? '' : _l('请选择')}
            className="CityPicker-input-textCon CityPicker-input-tagSearch"
            // 原来这里有个小写的 autofocus：React 不认它，动态插入的输入框浏览器也不会自动聚焦，从没生效过。
            // 没改成 autoFocus —— 那样筛选面板里每个条件的输入框一挂载都抢焦点，是用户从没见过的行为
            type="search"
            value={search}
            onChange={value => {
              onChangeInput({ search: value });
              onFetchData(value);
            }}
          />
          <label className="CityPicker-input-box_label">{search}</label>
        </InputWrap>
      )}
    </div>
  );
}

TagCon.propTypes = {
  disabled: PropTypes.bool,
  data: PropTypes.arrayOf(PropTypes.shape({})),
  renderItem: PropTypes.func,
  onRemove: PropTypes.func,
};

export default TagCon;
