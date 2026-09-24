import cx from 'classnames';
import { checkForm } from '../../constant';

export default function TextInput(props) {
  const { label, field, error, value, placeholder, onChange, onFocus, maxLength, ref, disabled, isRequired, type } =
    props;
  const inputProps = {
    ref,
    // 调用方（AddUser / EditUser / BaseFormInfo）全都是受控用法，但字段往往要等接口回来才有值，
    // 首帧是 undefined —— 输入框先按非受控挂上、数据到了再变受控，React 会报 uncontrolled → controlled。
    // 兜底成 '' 与首帧显示一致（非受控的空输入框本来就显示空）；下面的校验提示仍用原始 value。
    value: value ?? '',
    disabled,
    placeholder,
    onChange,
    onFocus,
    type,
  };

  if (type === 'password') {
    inputProps.autoComplete = 'new-password';
  }

  return (
    <div className="formGroup">
      <div className="formLabel">
        {label}
        {isRequired ? <span className="TxtMiddle Red">*</span> : null}
      </div>
      <input
        name="textInput"
        autoComplete="off"
        type="text"
        className={cx('formControl', { error, disabled, noBorder: disabled })}
        {...inputProps}
        maxLength={maxLength || Infinity}
      />
      {props.children}
      {error && checkForm[field] && <div className="Block Red LineHeight25 Hidden">{checkForm[field](value)}</div>}
    </div>
  );
}
