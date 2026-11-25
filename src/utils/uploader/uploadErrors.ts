import { getUploadError } from '../services/file/uploadError';
import { UploaderState } from './constants';
import type { Uploader, UploaderFile, UploadErrorInfo } from './types';

/** 每个上传器拥有独立的批次状态，事件分发前先执行这些处理器。 */
export default function bindUploadErrors(uploader: Pick<Uploader, 'state'>) {
  const securityErrors = new Map<string | UploaderFile | UploadErrorInfo, string>();

  function flush() {
    if (securityErrors.size === 0) return;
    const first = securityErrors.values().next().value;
    const message = securityErrors.size === 1 ? first : _l('%0 个文件检测到安全风险，无法上传', securityErrors.size);
    securityErrors.clear();
    if (message) alert(message, 2);
  }

  function handleError(error: UploadErrorInfo) {
    const uploadError = getUploadError(error.response, error.file?.name);
    if (!uploadError) return;

    error.uploadErrorHandled = true;
    error.uploadErrorMessage = uploadError.message;
    if (uploadError.isSecurityError) {
      securityErrors.set(error.file?.id || error.file || error, uploadError.message);
      if (uploader.state === UploaderState.STOPPED) flush();
    } else {
      alert(uploadError.message, 2);
    }
  }

  function handleStateChanged() {
    if (uploader.state === UploaderState.STOPPED) flush();
  }

  return { handleError, flush, handleStateChanged };
}
