import React, { useEffect, useRef, useState } from 'react';
import propTypes from 'prop-types';
import styled from 'styled-components';
import { FlexCenter, VerticalMiddle } from 'worksheet/components/Basics';

const SearchInputCon = styled(VerticalMiddle)`
  width: 220px;
  height: 36px;
  border-radius: 36px;
  background-color: var(--color-background-secondary);
  padding-left: 10px;
  overflow: hidden;
  input {
    flex: 1;
    border: none;
    margin-left: 2px;
    background-color: inherit;
  }
  &:hover {
    background-color: var(--color-border-secondary);
  }
`;

const BaseBtnCon = styled(FlexCenter)`
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 28px;
  margin-right: 2px;
  &:hover {
    background: var(--color-background-hover);
  }
`;

const FocusBtn = styled.div`
  display: inline-block;
  margin: 5px;
  font-size: 0px;
  cursor: pointer;
`;

let isOnComposition = false;

export default function SearchInput(props) {
  // name 是给浏览器认字段用的（缺了 DevTools 会报 "A form field element should have an
  // id or name attribute"）。同时必须配 autoComplete="off"：这个 input 此前一直没有
  // name，浏览器从没存过它的历史值；只补 name 会开始积累自动填充历史，多出一个下拉框
  // 盖住搜索结果——两个一起加才是「消掉提示且行为不变」。
  const { clickShowInput, placeholder, value, onChange, name = 'search' } = props;
  const inputRef = useRef<any>(undefined);
  const [isFocus, setIsFocus] = useState();

  useEffect(() => {
    if (clickShowInput && isFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocus]);

  useEffect(() => {
    !value && inputRef.current && (inputRef.current.value = '');
  }, [value]);

  if (clickShowInput && !isFocus) {
    return (
      <FocusBtn onClick={() => setIsFocus(true)}>
        <i className="icon icon-search Font20 textTertiary"></i>
      </FocusBtn>
    );
  }

  return (
    <SearchInputCon className={props.className}>
      <i className="icon icon-search Font18 textTertiary"></i>
      <input
        ref={inputRef}
        type="text"
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        onBlur={e => {
          if (e.target.value.trim() === '') {
            setIsFocus(false);
          }
        }}
        onChange={e => {
          !isOnComposition && onChange(e.target.value);
        }}
        onCompositionStart={() => (isOnComposition = true)}
        onCompositionEnd={e => {
          if (e.type === 'compositionend') {
            isOnComposition = false;
          }

          onChange(e.target.value);
        }}
      />
      {value && (
        <BaseBtnCon
          className="searchClearIcon"
          onClick={() => {
            inputRef.current.value = '';
            setIsFocus(false);
            onChange('');
          }}
        >
          <i className="icon icon-cancel textTertiary Font16"></i>
        </BaseBtnCon>
      )}
    </SearchInputCon>
  );
}

SearchInput.propTypes = {
  clickShowInput: propTypes.bool,
  placeholder: propTypes.string,
  value: propTypes.string,
  onChange: propTypes.func,
  name: propTypes.string,
};
