export { downloadFile, addToken } from 'src/utils/common';

export function downloadBlob(blob: Blob | null | undefined, filename: string): void {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
