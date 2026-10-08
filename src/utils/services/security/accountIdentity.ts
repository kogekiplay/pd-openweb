import { isVerifyCodeType, VERIFY_TYPE } from 'src/utils/domain/security/verification';
import { encrypt } from 'src/utils/services/security/encryption';

export const buildAccountIdentityParams = ({
  projectId = '',
  password = '',
  verifyCode = '',
  verifyType = VERIFY_TYPE.password,
  isNoneVerification = false,
  ticket,
  randStr,
  captchaType,
}: { projectId?: string | undefined; password?: string | undefined; verifyCode?: string | undefined; verifyType?: number | undefined; isNoneVerification?: boolean | undefined; ticket?: string | undefined; randStr?: string | undefined; captchaType?: number | undefined }) => {
  const baseParams = {
    projectId,
    isNoneVerification,
    type: verifyType,
  };

  if (isVerifyCodeType(verifyType)) {
    return {
      ...baseParams,
      verifyCode,
    };
  }

  return {
    ...baseParams,
    ticket,
    randStr,
    captchaType,
    password: encrypt(password),
  };
};
