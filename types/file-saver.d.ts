declare module 'file-saver' {
  export interface SaveAsOptions {
    autoBom?: boolean | undefined;
  }

  export function saveAs(
    data: Blob | string | File | ArrayBuffer | ArrayBufferView,
    filename?: string | undefined,
    options?: SaveAsOptions | undefined,
  ): void;
}
