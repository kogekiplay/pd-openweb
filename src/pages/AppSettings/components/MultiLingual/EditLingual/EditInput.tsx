import { useEffect, useState } from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { Input } from 'antd';

interface EditInputProps {
  className?: string | undefined;
  style?: CSSProperties | undefined;
  disabled?: boolean | undefined;
  /** textArea：多行输入 */
  type?: 'textArea' | undefined;
  value?: string | undefined;
  /** 失焦或回车时、且内容和 value 不同才触发；清空时给 undefined */
  onChange: (value: string | undefined) => void;
}

export default function (props: EditInputProps) {
  const { className, style, disabled, type, value, onChange } = props;
  const [name, setName] = useState(value);
  const Component = type === 'textArea' ? Input.TextArea : Input;

  useEffect(() => {
    setName(value);
  }, [value]);

  // 失焦和回车都走这里；键盘事件的 target 在类型上只是 EventTarget，读绑定处理器的那个输入框（currentTarget，就是它自己）
  const handleChangeName = (event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (value !== event.currentTarget.value) {
      onChange(event.currentTarget.value || undefined);
    }
  };

  return (
    <Component
      className={className}
      style={style}
      disabled={disabled}
      value={name}
      onChange={event => setName(event.target.value)}
      onBlur={handleChangeName}
      onKeyDown={event => {
        event.which === 13 && handleChangeName(event);
      }}
    />
  );
}
