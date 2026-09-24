import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useCallback } from 'react';
import type { ForwardedRef, ReactNode } from 'react';
import { QiniuUpload } from 'ming-ui';
import type { UploadedFileResponse, Uploader, UploaderFile } from 'src/utils/uploader/types';

interface UploadFilesProps {
  disabled?: boolean | undefined;
  /** 取上传凭证的业务类型，默认 32 */
  tokenType?: number | undefined;
  /** 已经在列表里的附件：和新选的加起来不能超过 maxFilesLength */
  existingFiles?: readonly unknown[] | undefined;
  maxFilesLength?: number | undefined;
  children?: ReactNode;
  /** 同时当拖放区和粘贴区的元素 id */
  dropElementId?: string | undefined;
  onAdd?: ((up: Uploader, files: UploaderFile[]) => void) | undefined;
  onUploaded?: ((up: Uploader, file: UploaderFile, response: UploadedFileResponse) => void) | undefined;
  onUploadProgress?: ((up: Uploader, file: UploaderFile) => void) | undefined;
  /** 上传失败：参数是失败的那个文件 */
  onError?: ((file: UploaderFile | undefined) => void) | undefined;
  /** 因超过大小被移出队列的文件，逐个回调 */
  removeFile?: ((file: UploaderFile) => void) | undefined;
  allowMultiSelection?: boolean | undefined;
  /** 后缀白名单，默认只收图片 */
  allowMimeTypes?: { title?: string; extensions: string }[] | undefined;
}

/** 通过 ref 拿到的 */
export interface UploadFilesHandle {
  /** 重新允许选择文件（出错后复位用） */
  clear: () => void;
  uploader: QiniuUpload | null;
}

function UploadFiles(
  {
    disabled,
    tokenType,
    existingFiles = [],
    maxFilesLength = 5,
    children,
    dropElementId,
    onAdd = () => {},
    onUploaded = () => {},
    onUploadProgress = () => {},
    onError = () => {},
    removeFile = () => {},
    allowMultiSelection = true,
    allowMimeTypes = [{ title: 'image', extensions: 'jpg,jpeg,png,heic' }],
  }: UploadFilesProps,
  ref: ForwardedRef<UploadFilesHandle>,
) {
  const uploaderRef = useRef<QiniuUpload | null>(null);
  const cache = useRef<{ existingFiles?: readonly unknown[] }>({});
  const handleClear = useCallback(() => {
    try {
      uploaderRef.current?.uploader?.disableBrowse(false);
    } catch (err) {
      console.error(err);
    }
  }, []);
  useImperativeHandle(ref, () => ({
    clear: handleClear,
    uploader: uploaderRef.current,
  }));
  useEffect(() => {
    cache.current.existingFiles = existingFiles;
  }, [existingFiles]);
  if (disabled) return <span className="InlineBlock">{children}</span>;
  return (
    <QiniuUpload
      ref={uploaderRef}
      options={{
        type: tokenType || 32,
        multi_selection: allowMultiSelection,
        drop_element: dropElementId,
        paste_element: dropElementId,
        filters: {
          mime_types: allowMimeTypes,
        },
        max_file_size: '10m',
        error_callback: () => {
          handleClear();
          alert(_l('有不合法的文件格式，请重新选择图片上传'), 3);
          return;
        },
        remove_files_callback: (up, files) => {
          files.forEach(file => {
            up.removeFile(file);
            removeFile(file);
          });
        },
      }}
      onAdd={(up, files) => {
        if (files.length + (cache.current.existingFiles?.length ?? 0) > maxFilesLength) {
          alert(_l('最多上传%0个文件', maxFilesLength), 2);
          files.forEach(file => {
            up.removeFile(file);
          });
          return;
        }

        onAdd(up, files);
      }}
      onUploadProgress={(up, file) => {
        onUploadProgress(up, file);
      }}
      onUploaded={(up, file, response) => {
        onUploaded(up, file, response);
      }}
      onError={(up, err, errorTip) => {
        alert(errorTip || _l('上传失败'), 2);
        handleClear();
        up.disableBrowse(false);
        onError(err.file);
      }}
    >
      {children}
    </QiniuUpload>
  );
}

export default forwardRef(UploadFiles);
