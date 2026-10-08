import { forwardRef } from 'react';
import { Input as AntdInput, type InputProps, type InputRef } from 'antd';

export interface HapInputProps extends InputProps {
  radius?: boolean | undefined;
}
const Input = forwardRef<InputRef, HapInputProps>(({ radius, style, ...props }, ref) => (
  <AntdInput {...props} ref={ref} style={{ ...(radius ? { borderRadius: 36 } : {}), ...style }} />
));
Input.displayName = 'HapInput';
export default Object.assign(Input, {
  Search: AntdInput.Search,
  TextArea: AntdInput.TextArea,
  Password: AntdInput.Password,
  OTP: AntdInput.OTP,
});
