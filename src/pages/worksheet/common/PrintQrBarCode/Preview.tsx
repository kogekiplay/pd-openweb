import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import styled from 'styled-components';
import { PRINT_TYPE } from './enum';
import img1 from './images/1x1.png';
import img2 from './images/1x2.png';
import img3 from './images/2x2.png';
import img4 from './images/2x5.png';
import img5 from './images/3x6.png';
import type { PrintLabelConfig } from './types';
import type { BarLabel, QrLabel } from './util';

const Con = styled.div`
  flex: 1;
  height: 100%;
  background: var(--color-border-secondary);
  display: flex;
  justify-content: center;
  align-items: center;
`;

const Label = styled.div`
  box-shadow: var(--shadow-lg);
  border-radius: 12px;
  overflow: hidden;
  font-size: 0px;
  canvas {
    width: 100% !important;
    height: 100% !important;
  }
`;

const A4PreviewImage = styled.div`
  margin: 0 auto;
  width: 300px;
  height: 420px;
  &.img1 {
    background-size: cover;
    background-image: url(${img1});
  }
  &.img2 {
    background-size: cover;
    background-image: url(${img2});
  }
  &.img3 {
    background-size: cover;
    background-image: url(${img3});
  }
  &.img4 {
    background-size: cover;
    background-image: url(${img4});
  }
  &.img5 {
    background-size: cover;
    background-image: url(${img5});
  }
`;

function A4Preview({ layout }: { layout: number | undefined }) {
  return <A4PreviewImage className={`img${layout}`} />;
}

function getPreviewSize(width: number, height: number) {
  let previewWidth, previewHeight;
  const maxHeight = (window.innerHeight - 50) * 0.9;
  const maxWidth = (window.innerWidth - 320) * 0.9;

  if (width > height) {
    previewHeight = 300;
    previewWidth = (width / height) * previewHeight;
    if (previewWidth > maxWidth) {
      previewWidth = maxWidth;
      previewHeight = (previewWidth / width) * height;
    }
  } else {
    previewWidth = 300;
    previewHeight = (height / width) * previewWidth;
    if (previewHeight > maxHeight) {
      previewHeight = maxHeight;
      previewWidth = (previewHeight / height) * width;
    }
  }

  return {
    width: previewWidth,
    height: previewHeight,
  };
}

type LabelPreview = Pick<BarLabel | QrLabel, 'options' | 'canvas' | 'render'>;
interface PreviewProps {
  config?: PrintLabelConfig | undefined;
  labelObject?: LabelPreview | undefined;
  style?: CSSProperties | undefined;
}

export default function Preview(props: PreviewProps) {
  const { config = {}, labelObject, style = {} } = props;
  const { printType } = config;
  const { width, height } = labelObject?.options || {};
  const [error, setError] = useState('');
  const con = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    setError('');
    const container = con.current;
    if (!labelObject || !container) return undefined;
    const showError = () => {
      if (active) setError(_l('加载失败'));
    };

    container.innerHTML = '';
    try {
      void labelObject.render().catch(showError);
      container.appendChild(labelObject.canvas);
    } catch {
      showError();
    }

    return () => {
      active = false;
    };
  }, [config, labelObject]);
  const previewSize = { ...getPreviewSize(width ?? 100, height ?? 100), display: error ? 'none' : undefined };
  return (
    <Con style={style}>
      {error && <span role="alert">{error}</span>}
      <Fragment>
        {printType === PRINT_TYPE.QR && <Label style={previewSize} ref={con} />}
        {printType === PRINT_TYPE.BAR && <Label style={previewSize} ref={con} />}
        {printType === PRINT_TYPE.A4 && <A4Preview layout={config.layout} />}
      </Fragment>
    </Con>
  );
}
