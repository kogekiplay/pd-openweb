export { formatFileSize, getIconNameByExt, getMimeTypeByExt } from 'src/utils/common';
export { getFilesSize, getFileExtends, isDocument } from 'src/components/UploadFiles/utils';

export const formatMediaDuration = (seconds = 0): string => {
  const minute = Math.trunc((seconds / 60) % 60);
  const hour = Math.trunc(seconds / 3600);
  const second = Math.trunc(seconds % 60);
  const duration = `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  return hour ? `${hour}:${duration}` : duration;
};
