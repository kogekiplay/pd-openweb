import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { number, string } from 'prop-types';
import genQr from 'src/pages/worksheet/common/PrintQrBarCode/genQrDataurl';

interface QrProps {
  content?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  gap?: number | undefined;
  correctLevel?: number | undefined;
  /** Legacy image attributes are accepted for compatibility; rendering uses the historical fixed attributes. */
  alt?: string | undefined;
  style?: CSSProperties | undefined;
}

export default function Qr({ content, width = 100, height = 100, gap = 0, correctLevel }: QrProps) {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    const data = genQr({
      value: String(content),
      width: width * 2,
      height: height * 2,
      gap: gap * 2,
      correctLevel: correctLevel || 0,
    });
    setUrl(data);
  }, [content]);
  return url ? <img style={{ width, height }} src={url} alt={content} /> : <div style={{ width, height }} />;
}

Qr.propTypes = {
  content: string,
  width: number,
  height: number,
  gap: number,
};
