import React from 'react';
import styled from 'styled-components';
import { Icon } from 'ming-ui';

const Con = styled.div`
  position: relative;
  width: 130px;
  height: 80px;
  border-radius: 10px;
  border: 1px solid var(--color-border-primary);
  overflow: hidden;
  flex-shrink: 0;
  .preview {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .uploadingProgress {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 10px;
    color: var(--color-text-secondary);
    font-size: var(--font-xs);
  }
  .icon {
    position: absolute;
    top: 5px;
    right: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: var(--font-xs);
    color: var(--color-text-secondary);
    background-color: var(--color-background-primary);
    box-shadow: var(--shadow-sm);
  }
  .uploading {
    color: var(--color-text-secondary) !important;
  }
`;

const ImageCard = ({ data = {}, removeFile }) => {
  const { status, progress, name } = data;
  const file = window.isMingDaoApp ? data : data.file;
  const fileUrl = file?.url;
  const percent = Number(progress);
  const isUploaded = status === 'uploaded' || window.isMingDaoApp;

  return (
    <Con>
      {isUploaded ? (
        <img className="preview" src={fileUrl} alt={name} />
      ) : (
        <div className="uploadingProgress">{status === 'uploading' ? `${percent}%` : _l('等待上传')}</div>
      )}

      <Icon icon="close" className={isUploaded ? '' : 'uploading'} onClick={() => removeFile(file)} />
    </Con>
  );
};

export default ImageCard;
