import { useEffect, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import Input, { type HapInputProps } from '../../antd-components/Input';

export interface SearchInputProps extends Omit<
  HapInputProps,
  'value' | 'onChange' | 'onCompositionStart' | 'onCompositionEnd'
> {
  value?: string | undefined;
  clickShowInput?: boolean | undefined;
  onChange: (value: string) => void;
}
export default function SearchInput({
  value,
  clickShowInput,
  onChange,
  variant = 'filled',
  ...props
}: SearchInputProps) {
  const inputRef = useRef<InputRef>(null);
  const [focused, setFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [compositionValue, setCompositionValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  useEffect(() => {
    if (clickShowInput && focused) inputRef.current?.focus();
  }, [clickShowInput, focused]);
  const change = (nextValue: string) => {
    if (value === undefined) setInputValue(nextValue);
    onChange(nextValue);
  };
  if (clickShowInput && !focused)
    return (
      <span className="Hand mLeft5 mRight5" onClick={() => setFocused(true)}>
        <i className="icon icon-search Font20 textTertiary" />
      </span>
    );
  return (
    <Input
      {...props}
      ref={inputRef}
      allowClear
      radius
      prefix={<i className="icon icon-search Font18 textTertiary" />}
      value={composing ? compositionValue : (value ?? inputValue)}
      variant={variant}
      onChange={event => {
        if (composing) setCompositionValue(event.target.value);
        else change(event.target.value);
      }}
      onCompositionStart={event => {
        setComposing(true);
        setCompositionValue(event.currentTarget.value);
      }}
      onCompositionEnd={event => {
        setComposing(false);
        change(event.currentTarget.value);
      }}
      onBlur={event => {
        if (!event.target.value.trim()) setFocused(false);
        props.onBlur?.(event);
      }}
      onClear={() => setFocused(false)}
    />
  );
}
