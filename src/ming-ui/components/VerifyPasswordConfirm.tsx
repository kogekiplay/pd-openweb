import { useCallback, useState } from 'react';
import { bool, func, number, string } from 'prop-types';
import { Dialog, VerifyPasswordInput } from 'ming-ui';
import functionWrap from 'ming-ui/components/FunctionWrap';
import verifyPassword from 'src/components/verifyPassword';

export default function VerifyPasswordConfirm(props) {
  const {
    confirmType = 'primary',
    width = 480,
    title,
    description,
    isRequired,
    allowNoVerify = false,
    closeImageValidation,
    onOk = () => {},
    onCancel,
  } = props;
  const [password, setPassword] = useState('');
  const [isNoneVerification, setIsNoneVerification] = useState(false);

  const handleConfirm = useCallback(() => {
    if (isRequired && (!password || !password.trim())) {
      alert(_l('请输入密码'), 3);
      return;
    }

    verifyPassword({
      password,
      isNoneVerification,
      closeImageValidation,
      success: () => {
        onCancel();
        onOk(password);
      },
    });
  }, [isRequired, password, isNoneVerification, closeImageValidation]);

  return (
    <Dialog
      visible
      className="verifyPasswordConfirm"
      width={width}
      overlayClosable={false}
      bindEnterTriggerOk={false}
      title={title || _l('安全验证')}
      description={description}
      onOk={handleConfirm}
      onCancel={onCancel}
      confirm={confirmType}
    >
      <div
        onKeyDown={event => {
          if (
            event.key !== 'Enter' ||
            event.repeat ||
            event.defaultPrevented ||
            event.nativeEvent.isComposing ||
            !(event.target instanceof HTMLInputElement) ||
            event.target.getAttribute('role') === 'combobox' ||
            !event.currentTarget.contains(event.target)
          )
            return;

          event.preventDefault();
          event.stopPropagation();
          handleConfirm();
        }}
      >
        <VerifyPasswordInput
          showSubTitle={false}
          autoFocus={true}
          isRequired={isRequired}
          allowNoVerify={allowNoVerify}
          onChange={({ password, isNoneVerification }) => {
            setPassword(password);
            setIsNoneVerification(isNoneVerification);
          }}
        />
      </div>
    </Dialog>
  );
}

VerifyPasswordConfirm.propTypes = {
  width: number,
  title: string,
  description: string,
  isRequired: bool,
  closeImageValidation: bool,
  onOk: func,
  onCancel: func,
};

VerifyPasswordConfirm.confirm = (props = {}) =>
  functionWrap(VerifyPasswordConfirm, { ...props, closeFnName: 'onCancel' });
