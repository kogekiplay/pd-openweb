declare module '@mdfe/qrcode-base' {
  /** The QR matrix encoder used by the canvas and vector label renderers. */
  export default class QRCode {
    constructor(typeNumber: number | undefined, errorCorrectLevel: number | undefined);
    addData(value: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }
}
