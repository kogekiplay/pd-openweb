import React from 'react';
import type { ReactNode } from 'react';
import _ from 'lodash';
import PropTypes from 'prop-types';
import createUploader from 'src/utils/createUploader';
import RegExpValidator from 'src/utils/expression';
import type {
  Uploader,
  UploaderEventArgs,
  UploaderFile,
  UploadedFileResponse,
  UploaderOption,
} from 'src/utils/uploader/types';

// 各回调就是 createUploader 对应事件的处理器（参数见 UploaderEventArgs），只有 onUploaded 例外
interface QiniuUploadProps {
  className?: string | undefined;
  /** 七牛 bucket 分类，传给取凭证接口 */
  bucket?: number | undefined;
  /** 取凭证接口的额外参数 */
  getTokenParam?: Record<string, unknown> | undefined;
  /** 其余上传选项，原样合并进 createUploader 的参数（同名的会盖掉上面这些） */
  options?: UploaderOption | undefined;
  children?: ReactNode;
  onInit?: ((...args: UploaderEventArgs['Init']) => void) | undefined;
  onAdd?: ((...args: UploaderEventArgs['FilesAdded']) => void) | undefined;
  onBeforeUpload?: ((...args: UploaderEventArgs['BeforeUpload']) => void) | undefined;
  /** 第三个参数是上传结果本身，【不是】事件里那个 { response } */
  onUploaded?: ((up: Uploader, file: UploaderFile, response: UploadedFileResponse) => void) | undefined;
  onUploadProgress?: ((...args: UploaderEventArgs['UploadProgress']) => void) | undefined;
  onUploadComplete?: ((...args: UploaderEventArgs['UploadComplete']) => void) | undefined;
  onError?: ((...args: UploaderEventArgs['Error']) => void) | undefined;
}

export default class QiniuUpload extends React.Component<QiniuUploadProps> {
  // ref 回调和 componentDidMount 里赋值
  declare upload?: HTMLDivElement | null;
  declare uploader?: Uploader;

  static override propTypes = {
    className: PropTypes.string,
    bucket: PropTypes.number,
    options: PropTypes.shape({}),
    children: PropTypes.element,
    onInit: PropTypes.func,
    onAdd: PropTypes.func,
    onUploaded: PropTypes.func,
    onUploadProgress: PropTypes.func,
    onBeforeUpload: PropTypes.func,
    onError: PropTypes.func,
    onUploadComplete: PropTypes.func,
  };

  override componentDidMount() {
    const {
      options,
      onInit = () => {},
      onAdd = () => {},
      onUploaded = () => {},
      onUploadProgress = () => {},
      onBeforeUpload = () => {},
      onError = () => {},
      onUploadComplete = () => {},
      bucket,
      getTokenParam = {},
    } = this.props;

    if (this.upload) {
      this.uploader = createUploader(
        _.assign(
          {},
          {
            browse_button: this.upload,
            bucket,
            getTokenParam,
            init: {
              Init: onInit,
              FilesAdded: onAdd,
              BeforeUpload: (up, file) => {
                const fileExt = `.${RegExpValidator.getExtOfFileName(file.name)}`;
                up.settings.multipart_params = { token: file.token };
                up.settings.multipart_params.key = file.key;
                up.settings.multipart_params['x:serverName'] = file.serverName;
                up.settings.multipart_params['x:filePath'] = (file.key || '').replace(file.fileName, '');
                up.settings.multipart_params['x:fileName'] = (file.fileName || '').replace(/\.[^.]*$/, '');
                up.settings.multipart_params['x:originalFileName'] = encodeURIComponent(
                  file.name.indexOf('.') > -1 ? file.name.split('.').slice(0, -1).join('.') : file.name,
                );
                up.settings.multipart_params['x:fileExt'] = fileExt;
                onBeforeUpload(up, file);
              },
              FileUploaded: (up, file, info) => {
                onUploaded(up, file, info.response);
              },
              UploadProgress: (uploader, file) => {
                onUploadProgress(uploader, file);
              },
              UploadComplete: (up, files) => {
                onUploadComplete(up, files);
              },
              Error: (...args: UploaderEventArgs['Error']) => {
                onError(...args);
              },
            },
          },
          options,
        ),
      );
    }
  }

  override componentWillUnmount() {
    if (this.uploader) {
      this.uploader.destroy();
    }
  }

  override render() {
    const { className, children } = this.props;
    return (
      <div className={`InlineBlock ${className || ''}`} ref={con => { this.upload = con; }}>
        {children}
      </div>
    );
  }
}
