import JsBarcode from 'jsbarcode';
import _ from 'lodash';
import genQrDataURL from 'src/pages/worksheet/common/PrintQrBarCode/genQrDataurl';
import { renderText as renderCellText } from 'src/utils/control';
import type { RecordRow } from 'src/utils/controlTypes';
import type { FormControl } from 'src/utils/controlTypes';
import {
  BAR_LABEL_SIZE,
  BAR_LABEL_SIZES,
  BAR_LAYOUT,
  BAR_POSITION,
  LANDSCAPE_QR_CODE_SIZE,
  PORTRAIT_QR_CODE_SIZE,
  PRINT_TYPE,
  QR_LABEL_SIZE,
  QR_LABEL_SIZES,
  QR_LAYOUT,
  QR_POSITION,
  SOURCE_TYPE,
} from './enum';
import type { CodeUrlSource, LabelText, PrintLabelConfig } from './types';

export type { PrintLabelConfig } from './types';

export function getDefaultText({
  printType,
  sourceType,
  sourceControlId,
  controls = [],
}: PrintLabelConfig & { controls?: FormControl[] } = {}) {
  if (sourceType === SOURCE_TYPE.URL) {
    return {
      type: 1,
      value: (_.find(controls, { attribute: 1 }) || {}).controlId,
      forceInLine: false,
      name: '',
    };
  } else if (sourceType === SOURCE_TYPE.CONTROL && sourceControlId && printType === PRINT_TYPE.BAR) {
    return {
      type: 2,
      value: (_.find(controls, { controlId: sourceControlId }) || {}).controlName,
      forceInLine: false,
      name: '',
    };
  } else if (sourceType === SOURCE_TYPE.CONTROL && sourceControlId) {
    return {
      type: 1,
      value: sourceControlId,
      forceInLine: false,
      name: '',
    };
  }

  return undefined;
}

const DPI_MM = 8;

export function createQrLabeObjectFromConfig(
  config: PrintLabelConfig = {},
  url: string,
  texts: CanvasTexts = [],
  options: QrLabelOptions = {},
) {
  let width, height;

  if (config.labelSize === QR_LABEL_SIZE.CUSTOM) {
    width = required(config.labelCustomWidth, 'custom width') * DPI_MM;
    height = required(config.labelCustomHeight, 'custom height') * DPI_MM;
  } else {
    const configWidth = labelSize(QR_LABEL_SIZES, config.labelSize).width * DPI_MM;
    const configHeight = labelSize(QR_LABEL_SIZES, config.labelSize).height * DPI_MM;
    width = config.layout === QR_LAYOUT.LANDSCAPE ? configWidth : configHeight;
    height = config.layout === QR_LAYOUT.LANDSCAPE ? configHeight : configWidth;
  }

  let layout;

  if (config.labelSize === QR_LABEL_SIZE.CUSTOM) {
    layout = width > height ? 'l' : 'p';
  } else {
    layout = config.layout === QR_LAYOUT.PORTRAIT ? 'p' : 'l';
  }

  const labelObject = new QrLabel({
    type: layout,
    size: mappedSize(
      (config.layout === QR_LAYOUT.PORTRAIT ? PORTRAIT_QR_CODE_SIZE : LANDSCAPE_QR_CODE_SIZE).shorts,
      Number(config.codeSize),
    ),
    fontSize: config.fontSize,
    width,
    height,
    firstIsTitle: config.firstIsBold,
    correctLevel: config.codeFaultTolerance || 1,
    qrPos: {
      [QR_POSITION.TOP]: 'top',
      [QR_POSITION.BOTTOM]: 'bottom',
      [QR_POSITION.LEFT]: 'left',
      [QR_POSITION.RIGHT]: 'right',
    }[config.position ?? -1],
    url,
    texts: texts,
    ...options,
  });
  return labelObject;
}

function sliceByByteLength(str = '', length = 0) {
  let result = '';
  let size = 0;

  for (let i = 0; i < str.length; i++) {
    const charSize = new Blob([str.charAt(i)]).size;

    if (size + charSize <= length) {
      result += str[i];
      size += charSize;
    } else {
      break;
    }
  }

  return result;
}

export function getCodeTexts(
  { showTexts = [], firstIsBold, showControlName, controls }: PrintLabelConfig & { controls?: FormControl[] } = {},
  data: Record<string, unknown> = {},
) {
  return (
    showTexts
      .map((item, i) => {
        if (!item) {
          return undefined;
        }

        const newItem = {
          forceInLine: item.forceInLine,
        };

        if (item.type === 2) {
          return { ...newItem, text: item.value };
        } else {
          const matchedControl = _.find(controls, { controlId: item.value });

          if (!matchedControl) {
            return { ...newItem, text: '' };
          }

          const controlText = renderedText({ ...matchedControl, value: data[String(item.value)] });
          return {
            ...newItem,
            text:
              showControlName && !(firstIsBold && i === 0)
                ? `${item.name || matchedControl.controlName}: ${controlText}`
                : controlText,
          };
        }
      })
      // .map(t => (t || (emptySetAsSample ? 'SAMPLE' : ''))
      .slice(0, 100)
  );
}

export function getCodeContent({
  printType,
  sourceType,
  sourceControlId,
  row = {},
  urls = {},
  index,
  controls,
}: PrintLabelConfig & {
  row?: RecordRow;
  urls?: CodeUrlSource;
  index?: number;
  controls?: FormControl[];
}) {
  let content: string | undefined = '';

  if (sourceType === SOURCE_TYPE.URL) {
    content = sourceUrl(urls, row.rowid) || sourceUrl(urls, index);
  } else if (sourceType === SOURCE_TYPE.CONTROL) {
    const matchedControl = _.find(controls, { controlId: sourceControlId });

    if (matchedControl && row[String(sourceControlId)]) {
      content = renderedText({ ...matchedControl, value: row[String(sourceControlId)] });
    }
  }

  if (printType === PRINT_TYPE.BAR) {
    content = sliceByByteLength(required(content, 'barcode content').replace(/[^\x00-\x7F]/g, ''), 30);
  } else {
    content = sliceByByteLength(content, 150 * 3);
  }

  return content;
}

export function createBarLabeObjectFromConfig(
  config: PrintLabelConfig = {},
  value: string,
  texts: CanvasTexts = [],
  /* 调用点除了 isPreview 还会传 pixelRadio（print.ts 的条码分支传 1.5），所以类型取 BarLabelOptions 的子集。
     【注意：pixelRadio 在这里没有生效】下面 new BarLabel 从来没收它（上游原本就只解构了 isPreview），
     条码标签一直按 BarLabel 的默认 2 倍渲染；二维码那一路（createQrLabeObjectFromConfig）是 ...options 透传的，1.5 生效。
     透下去会把已经用了很久的条码打印分辨率从 2 倍降到 1.5 倍 —— 对要上扫码枪的条码是实打实的风险，没有顺手改。 */
  { isPreview = false }: BarLabelOptions = {},
) {
  let width, height;

  if (config.labelSize === BAR_LABEL_SIZE.CUSTOM) {
    width = required(config.labelCustomWidth, 'custom width') * DPI_MM;
    height = required(config.labelCustomHeight, 'custom height') * DPI_MM;
  } else {
    const configWidth = labelSize(BAR_LABEL_SIZES, config.labelSize).width * DPI_MM;
    const configHeight = labelSize(BAR_LABEL_SIZES, config.labelSize).height * DPI_MM;
    width = config.layout === BAR_LAYOUT.LANDSCAPE ? configWidth : configHeight;
    height = config.layout === BAR_LAYOUT.LANDSCAPE ? configHeight : configWidth;
  }

  const barLabel = new BarLabel({
    isPreview,
    value,
    width,
    height,
    firstIsTitle: config.firstIsBold,
    fontSize: config.fontSize,
    showBarValue: config.showBarValue,
    codePosition: {
      [BAR_POSITION.TOP]: 'top',
      [BAR_POSITION.BOTTOM]: 'bottom',
    }[config.position ?? -1],
    size: ['l', 'm', 's'][Number(config.codeSize) - 1],
    texts,
  });
  return barLabel;
}

type CanvasLabelText = LabelText;
type CanvasTexts = Array<CanvasLabelText | undefined>;
interface CanvasLabelLayout {
  paddingX: number;
  paddingY: number;
  fontSize: number;
}
interface BarLayout extends CanvasLabelLayout {
  height: number;
}
interface QrLayout extends CanvasLabelLayout {
  codeSize: number;
}
export interface BarLabelOptions {
  isDebug?: boolean | undefined;
  isPreview?: boolean | undefined;
  pixelRadio?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  fontSize?: number | undefined;
  firstIsTitle?: boolean | undefined;
  showBarValue?: boolean | undefined;
  codePosition?: string | undefined;
  size?: string | undefined;
  value?: string | undefined;
  texts?: CanvasTexts | undefined;
}
interface BarSettings {
  isDebug: boolean;
  isPreview: boolean;
  pixelRadio: number;
  width: number;
  height: number;
  fontSize: number;
  firstIsTitle: boolean;
  showBarValue: boolean;
  codePosition: string;
  size: string;
  value?: string | undefined;
  texts: CanvasTexts;
}
const BAR_DEFAULTS: BarSettings = {
  isDebug: false,
  isPreview: false,
  pixelRadio: 2,
  width: 100,
  height: 100,
  fontSize: 1,
  firstIsTitle: false,
  showBarValue: true,
  codePosition: 'top',
  size: 'm',
  texts: [],
};
export interface QrLabelOptions {
  isPreview?: boolean | undefined;
  pixelRadio?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  fontSize?: number | undefined;
  firstIsTitle?: boolean | undefined;
  type?: string | undefined;
  size?: string | undefined;
  correctLevel?: number | undefined;
  qrPos?: string | undefined;
  url?: string | undefined;
  texts?: CanvasTexts | undefined;
}
interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface FontOptions {
  minFontSize?: number;
  maxFontSize?: number;
  fontFamily?: string;
  precision?: number;
}
interface TextOptions {
  x?: number;
  y?: number;
  fontSize: number;
  content: string;
  width: number;
  isCenter?: boolean | undefined;
  forceInLine?: boolean | undefined;
  isBold?: boolean | undefined;
  color?: string;
}
function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new TypeError('Missing label ' + name);
  return value;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  return context;
}

function labelSize(sizes: Readonly<Record<number, { width: number; height: number }>>, id: number | undefined) {
  return required(sizes[id ?? -1], 'size');
}

function mappedSize(sizes: Readonly<Record<number, string>>, id: number) {
  return required(sizes[id], 'code size');
}

function property(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined;
}

function renderedText(control: FormControl): string {
  const value: unknown = renderCellText(control);
  if (typeof value !== 'string') throw new TypeError('Invalid rendered label text');
  return value;
}

function sourceUrl(urls: CodeUrlSource, key: string | number | undefined): string | undefined {
  const value: unknown = Reflect.get(urls, String(key));
  if (value !== undefined && typeof value !== 'string') throw new TypeError('Invalid label URL');
  return typeof value === 'string' ? value : undefined;
}

class TextMeasure {
  // 构造函数里的 this.x = ... 在 TS 里不构成字段声明，不写这两行每次读取都报 TS2339。
  // declare 是纯类型声明，babel 的 TS preset 整行擦除，运行时无影响。
  declare canvas: HTMLCanvasElement;
  declare ctx: CanvasRenderingContext2D;

  constructor() {
    this.initCanvas();
  }

  initCanvas() {
    this.canvas = document.createElement('canvas');
    this.ctx = context2d(this.canvas);

    // 隐藏但不添加到 DOM
    this.canvas.style.cssText = `
      position: absolute;
      visibility: hidden;
    `;
  }

  measureText(text: string, fontSize: number, fontFamily: string) {
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    return this.ctx.measureText(text).width;
  }

  findOptimalFontSize(text: string, containerWidth: number, options: FontOptions = {}) {
    const { minFontSize = 2, maxFontSize = 72, fontFamily = 'sans-serif', precision = 0.2 } = options;

    let low = minFontSize;
    let high = maxFontSize;
    let bestSize = minFontSize;

    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const textWidth = this.measureText(text, mid, fontFamily);

      if (textWidth <= containerWidth) {
        bestSize = mid;
        low = mid;
      } else {
        high = mid;
      }

      if (high - low < precision) break;
    }

    return Math.floor(bestSize * 10) / 10;
  }
}

export function getCompressedFontSize(value: string, width: number, options: FontOptions = {}) {
  const textMeasure = new TextMeasure();
  return textMeasure.findOptimalFontSize(value, width, options);
}

const BAR_FONT_SIZE = 15;

function parseToCode128(value: string) {
  const parsed = JsBarcode({}, value, {
    format: 'CODE128',
  });
  const result: unknown = parsed;
  const first: unknown = property(property(property(result, '_encodings'), '0'), '0');
  const data = property(first, 'data');
  if (typeof data !== 'string') throw new TypeError('Invalid CODE128 encoder result');
  return { data };
}

function getBarcodeBase64(value: string, { width = 100, height = 100 } = {}) {
  const canvas = document.createElement('canvas');
  const fontSize = Math.max((height / 100) * 7, BAR_FONT_SIZE);
  const code128 = parseToCode128(value);
  JsBarcode(canvas, value, {
    format: 'CODE128',
    width: width / (code128.data.length < 90 ? 90 : code128.data.length),
    height: height - fontSize - 4,
    displayValue: false,
    margin: 0,
    lineColor: '#000000',
  });
  return {
    dataUrl: canvas.toDataURL(),
    width: canvas.width,
  };
}

export class BarLabel {
  // 同 TextMeasure：这些字段只在 setOptions/setLayoutParams/init 里赋值，
  // 不声明的话每次读取报 TS2339（本文件因此有 117 条）。
  declare options: BarSettings;
  declare layout: BarLayout;
  declare canvas: HTMLCanvasElement;
  declare ctx: CanvasRenderingContext2D;
  /** 乘过 pixelRadio 之后的画布像素宽高 */
  declare _width: number;
  declare _height: number;
  declare unitSize: number;
  declare maxLineNumber: number;

  constructor({
    isDebug = false,
    isPreview = false,
    // isDebug = true,
    pixelRadio = 2,
    width = 100,
    height = 100,
    fontSize = 1,
    firstIsTitle = false,
    showBarValue = true,
    codePosition = 'top',
    size = 'm',
    value,
    texts = [],
  }: BarLabelOptions = {}) {
    this.setOptions({
      isDebug,
      isPreview,
      pixelRadio,
      width,
      height,
      fontSize: fontSize || 1,
      size,
      firstIsTitle,
      codePosition,
      value,
      texts,
      showBarValue,
    });
    this.setLayoutParams();
    this.init();
  }
  setOptions(values: Partial<BarSettings>) {
    this.options = Object.assign({}, BAR_DEFAULTS, this.options, values);
  }
  setLayoutParams() {
    const { size, width, height } = this.options;
    const codeSizes: Record<string, number> =
      width > height
        ? {
            l: 18,
            m: 14,
            s: 9,
          }
        : {
            l: 19,
            m: 14,
            s: 9,
          };
    this.layout = {
      paddingX: 3,
      paddingY: 2,
      height: required(codeSizes[size], 'barcode size'),
      fontSize: 5,
    };
  }
  init() {
    const { width, height, pixelRadio } = this.options;
    const _width = width * pixelRadio;
    this._width = _width;
    const _height = height * pixelRadio;
    this._height = _height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = _width;
    this.canvas.height = _height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx = context2d(this.canvas);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, _width, _height);
    this.unitSize = _width > _height ? _height / 30 : _width / 30;
    this.maxLineNumber = Math.floor(
      (_height - (this.layout.paddingY + this.layout.height + 2) * this.unitSize) /
        (this.layout.fontSize * this.unitSize),
    );
  }
  async render() {
    const { isDebug, showBarValue } = this.options;

    if (isDebug) {
      this.drawPadding();
      this.drawGrid();
    }

    await this.drawBar();
    if (showBarValue) {
      this.drawBarText();
    }

    this.drawTexts();
  }
  // 处理文字换行
  cutTextByWidth(fontSize: number, context: string | undefined, maxWidth: number) {
    let result = [];
    this.ctx.font = fontSize + 'px sans-serif';
    if (this.ctx.measureText(String(context)).width < maxWidth) {
      return [context];
    }

    const content = required(context, 'text to wrap');
    let text = '';

    for (let i = 0; i < content.length; i++) {
      text += content.charAt(i);
      const width = this.ctx.measureText(text).width;

      if (width > maxWidth) {
        result.push(text.slice(0, -1));
        text = text.slice(-1);
      }
    }

    if (text) {
      result.push(text);
    }

    return result;
  }
  // 绘制参考网格
  drawGrid() {
    const colNum = Math.floor(this._width / this.unitSize);
    const rowNum = Math.floor(this._height / this.unitSize);
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = '#ccc';
    for (let colIndex = 1; colIndex < colNum + 1; colIndex++) {
      this.ctx.beginPath();
      this.ctx.moveTo(colIndex * this.unitSize, 0);
      this.ctx.lineTo(colIndex * this.unitSize, this._height);
      this.ctx.stroke();
    }

    for (let rowIndex = 1; rowIndex < rowNum + 1; rowIndex++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, rowIndex * this.unitSize);
      this.ctx.lineTo(this._width, rowIndex * this.unitSize);
      this.ctx.stroke();
    }
  }
  // 绘制参考 padding
  drawPadding() {
    const { paddingX, paddingY } = this.layout;
    this.ctx.fillStyle = '#caccfe';
    this.ctx.fillRect(0, 0, this._width, this._height);
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(
      3 * this.unitSize,
      2 * this.unitSize,
      this._width - 2 * paddingX * this.unitSize,
      this._height - 2 * paddingY * this.unitSize,
    );
  }
  drawImageUrl(url: string, { x, y, width, height }: ImageBounds) {
    return new Promise<void>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        this.ctx.drawImage(image, x, y, width, height);
        resolve();
      };

      image.onerror = () => reject(new Error('Label image could not be loaded'));
      image.src = url;
    });
  }
  async drawBar() {
    const { value, codePosition } = this.options;
    const { paddingX, paddingY, height } = this.layout;
    let dataUrl;
    const barWidth = this._width - 2 * paddingX * this.unitSize;
    const codeSize = height * this.unitSize * 0.9;

    if (_.isUndefined(value) || value === '') {
      return;
    }

    const code128 = parseToCode128(value);
    const barObj = getBarcodeBase64(value, { height: height * this.unitSize, width: barWidth });
    dataUrl = value && barObj.dataUrl;
    const top = codePosition === 'top' ? paddingY * this.unitSize : this._height - paddingY * this.unitSize - codeSize;

    if (value && dataUrl) {
      await this.drawImageUrl(dataUrl, {
        x:
          code128.data.length < 90
            ? paddingX * this.unitSize + (barWidth - barObj.width) / 2
            : paddingX * this.unitSize,
        y: top,
        width: code128.data.length < 90 ? barObj.width : barWidth,
        height: codeSize,
      });
    }

    if (this.options.isDebug) {
      this.ctx.fillStyle = '#ddd';
      this.ctx.fillRect(
        paddingX * this.unitSize,
        top,
        this._width - 2 * paddingX * this.unitSize,
        height * this.unitSize,
      );
    }
  }
  drawBarText() {
    const { value, codePosition } = this.options;
    const { paddingX, paddingY, height } = this.layout;
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#151515';
    const text =
      this.cutTextByWidth(2 * this.unitSize, value, this._width - paddingX * 2 * this.unitSize).slice(0, 1)[0] || '';
    this.ctx.font = 2 * this.unitSize + 'px "Times New Roman"';
    this.ctx.fillText(
      text,
      this._width / 2,
      codePosition === 'top'
        ? (paddingY + height * 0.95) * this.unitSize
        : this._height - (paddingY + height * 1.08) * this.unitSize,
    );
  }
  measureTextWidth(value: string, fontSize: number) {
    const canvas = document.createElement('canvas');
    const ctx = context2d(canvas);
    ctx.font = fontSize + 'px sans-serif';
    return ctx.measureText(value).width;
  }
  drawTexts() {
    let { isPreview, firstIsTitle, codePosition, texts, showBarValue } = this.options;
    const { paddingX, paddingY, height, fontSize } = this.layout;
    const textX = paddingX * this.unitSize;
    const textY =
      codePosition === 'top' ? (paddingY + height + (showBarValue ? 2 : 0)) * this.unitSize : paddingY * this.unitSize;
    const textWidth = this._width - 2 * paddingX * this.unitSize;
    const textHeight = fontSize * this.unitSize;
    texts = _.flatten<CanvasLabelText>(
      texts.map(({ text, forceInLine } = {}, i) =>
        forceInLine
          ? {
              text,
              forceInLine,
              isBold: firstIsTitle && i === 0,
            }
          : this.cutTextByWidth(
              textHeight * 0.6 * (firstIsTitle && i === 0 ? 1 : this.options.fontSize),
              text,
              this._width - paddingX * 2 * this.unitSize,
            ).map(t => ({
              text: t,
              isBold: firstIsTitle && i === 0,
            })),
      ),
    ).slice(0, this.maxLineNumber);
    this.ctx.textBaseline = 'top';
    this.ctx.strokeStyle = '#ccc';
    this.ctx.fillStyle = '#000';
    this.ctx.setLineDash([4, 8]);
    const titleIsSplitted = texts.filter(t => t?.isBold).length > 1;
    texts.forEach(({ text, isBold, forceInLine } = {}, i) => {
      if (!text) {
        return;
      }

      let textFontSize = textHeight * 0.6 * this.options.fontSize;
      const isCenter = !titleIsSplitted && isBold && i === 0;

      if (forceInLine) {
        const contentWidth = this.measureTextWidth(text, textFontSize);

        if (contentWidth > textWidth) {
          textFontSize = getCompressedFontSize(text, textWidth);
        } else {
          forceInLine = false;
        }
      }

      if (isBold) {
        this.ctx.font = 'bold ' + textFontSize + 'px sans-serif';
      } else {
        this.ctx.font = textFontSize + 'px sans-serif';
      }

      this.ctx.textAlign = isCenter && !forceInLine ? 'center' : 'left';
      if (isPreview) {
        this.ctx.strokeRect(0 - 1, textY + i * textHeight, this._width + 2, textHeight);
      }

      this.ctx.fillText(
        text,
        isCenter && !forceInLine ? textX + textWidth / 2 : textX,
        textY + i * textHeight + (textHeight - textFontSize) / 2,
      );
    });
  }
}

export class QrLabel {
  // 同上，不声明每次读取报 TS2339（本文件因此有 91 条）。
  declare options: QrLabelOptions;
  declare layout: QrLayout;
  declare canvas: HTMLCanvasElement;
  declare ctx: CanvasRenderingContext2D;
  /** 乘过 pixelRadio 之后的画布像素宽高 */
  declare width: number;
  declare height: number;
  declare pixelRadio: number;
  declare fontSize: number;
  declare firstIsTitle: boolean | undefined;
  declare unitSize: number;
  declare maxLineNumber: number;

  // portrait 肖像 高度大
  // landscape 风景 宽度大
  constructor(options: QrLabelOptions = {}) {
    this.options = options;
    this.setOptions();
    this.setLayout();
    this.init();
  }
  async render() {
    if (this.options.type === 'p') {
      await this.renderPortrait();
    } else {
      await this.renderLandscape();
    }
  }
  setOptions() {
    const { pixelRadio = 2, width = 100, height = 100, fontSize = 1, firstIsTitle } = this.options;
    this.pixelRadio = pixelRadio;
    this.width = width * pixelRadio;
    this.height = height * pixelRadio;
    this.firstIsTitle = firstIsTitle;
    this.fontSize = fontSize || 1;
  }
  setLayout() {
    const codeSizes: Record<string, number> =
      this.options.type === 'p' ? { s: 11, m: 16, l: 20, h: 24 } : { s: 13, m: 16, l: 20, h: 24 };
    this.layout = {
      paddingX: 3,
      paddingY: 2,
      fontSize: 5,
      codeSize: required(codeSizes[this.options.size ?? ''], 'QR size'),
    };
  }
  init() {
    const { type } = this.options;
    const { paddingY, codeSize, fontSize } = this.layout;
    const canvas = this.canvas || document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = context2d(canvas);
    this.canvas = canvas;
    this.ctx = ctx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, this.width, this.height);
    this.unitSize = Math.min(this.width, this.height) / 30;
    this.maxLineNumber =
      type === 'p'
        ? Math.floor((this.height - (paddingY + codeSize + 2) * this.unitSize) / (fontSize * this.unitSize))
        : 5;
  }
  // 处理文字换行
  cutTextByWidth(fontSize: number, context: string | undefined, maxWidth: number, isBold: boolean | undefined) {
    let result = [];
    this.ctx.font = (isBold ? 'bold ' : '') + fontSize * this.fontSize + 'px sans-serif';
    if (this.ctx.measureText(String(context)).width < maxWidth) {
      return [context];
    }

    const content = required(context, 'text to wrap');
    let text = '';

    for (let i = 0; i < content.length; i++) {
      text += content.charAt(i);
      const width = this.ctx.measureText(text).width;

      if (width > maxWidth) {
        result.push(text.slice(0, -1));
        text = text.slice(-1);
      }
    }

    if (text) {
      result.push(text);
    }

    return result;
  }
  measureTextWidth(value: string, fontSize: number) {
    const canvas = document.createElement('canvas');
    const ctx = context2d(canvas);
    ctx.font = fontSize + 'px sans-serif';
    return ctx.measureText(value).width;
  }
  renderText({ x = 0, y = 0, fontSize, content, width, isCenter, forceInLine, isBold, color = '#222' }: TextOptions) {
    this.ctx.textBaseline = 'top';
    let textFontSize = fontSize * 0.55 * this.fontSize;

    if (forceInLine) {
      const textWidth = this.measureTextWidth(content, textFontSize);

      if (textWidth > width) {
        textFontSize = getCompressedFontSize(content, width);
      } else {
        forceInLine = false;
      }
    }

    if (isBold) {
      this.ctx.font = 'bold ' + textFontSize + 'px sans-serif';
    } else {
      this.ctx.font = textFontSize + 'px sans-serif';
    }

    this.ctx.textAlign = isCenter && !forceInLine ? 'center' : 'left';
    this.ctx.fillStyle = color;
    this.ctx.fillText(content, isCenter && !forceInLine ? x + width / 2 : x, y + (fontSize - textFontSize) / 2);
  }
  renderVerticalTexts({
    x = 0,
    y = 0,
    fontSize,
    textList,
    color = '#222',
    width,
    firstIsBold,
  }: {
    textList: CanvasTexts;
    x: number;
    y: number;
    width: number;
    fontSize: number;
    firstIsBold: boolean;
    color?: string | undefined;
  }) {
    const { isPreview } = this.options;
    let textTop = y;
    /* 泛型必须显式写：map 的回调要么返回单个对象、要么返回对象数组，
       lodash 的 flatten 从这个并集推不出元素类型，会得到 unknown[] */
    const texts = _.flatten<CanvasLabelText>(
      textList.map(({ text, forceInLine } = {}, i) =>
        forceInLine
          ? { text, forceInLine, isBold: this.firstIsTitle && i === 0 }
          : this.cutTextByWidth(fontSize * 0.55, text, width, firstIsBold && this.firstIsTitle && i === 0).map(t => ({
              text: t,
              isBold: this.firstIsTitle && i === 0,
            })),
      ),
    ).slice(0, this.maxLineNumber);
    const titleIsSplitted = texts.filter(t => t?.isBold).length > 1;
    texts.forEach(({ text, forceInLine, isBold } = {}, i) => {
      const textIsBold = firstIsBold && isBold;

      if (text === '' || _.isUndefined(text)) {
        textTop += fontSize;
        return;
      }

      this.renderText({
        x,
        y: textTop,
        fontSize,
        content: text,
        width,
        forceInLine,
        isBold: textIsBold,
        isCenter: this.options.type === 'p' && textIsBold && i === 0 && !titleIsSplitted,
        color,
      });
      if (isPreview) {
        const lineWidth = fontSize / 40;
        this.ctx.strokeStyle = '#ccc';
        this.ctx.lineWidth = lineWidth;
        this.ctx.setLineDash([lineWidth * 2, lineWidth * 4]);
        this.ctx.strokeRect(-1 * lineWidth, textTop, this.width + 2 * lineWidth, fontSize);
      }

      textTop += fontSize;
    });
  }
  drawImageUrl(url: string, { x, y, width, height }: ImageBounds) {
    return new Promise<void>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const renderWidth = (image.width * height) / image.height;

        if (renderWidth < width) {
          x += (width - renderWidth) / 2;
        }

        this.ctx.drawImage(image, x, y, renderWidth, height);
        resolve();
      };

      image.onerror = () => reject(new Error('Label image could not be loaded'));
      image.src = url;
    });
  }
  async renderPortrait() {
    const { qrPos = 'top', texts = [], url, correctLevel } = this.options;
    const { paddingX, paddingY, codeSize, fontSize } = this.layout;
    this.renderVerticalTexts({
      textList: texts,
      x: paddingX * this.unitSize,
      y: qrPos === 'top' ? (paddingY + codeSize + 2) * this.unitSize : paddingY * this.unitSize,
      width: this.width - paddingX * 2 * this.unitSize,
      fontSize: fontSize * this.unitSize,
      firstIsBold: true,
    });
    const qrDataUrl = url && genQrDataURL({ value: url, correctLevel });

    if (qrDataUrl) {
      await this.drawImageUrl(qrDataUrl, {
        x: (this.width - codeSize * this.unitSize) / 2,
        y: qrPos === 'top' ? paddingY * this.unitSize : this.height - (paddingY + codeSize) * this.unitSize,
        width: codeSize * this.unitSize,
        height: codeSize * this.unitSize,
      });
    }
  }
  async renderLandscape() {
    const { size, texts = [], qrPos, url, correctLevel } = this.options;
    const { paddingX, paddingY, fontSize, codeSize } = this.layout;
    const topTextCounts: Record<string, number> = {
      s: 2,
      m: 1,
      l: 0,
      h: 0,
    };
    const topTextNum = required(topTextCounts[size ?? ''], 'QR size');
    this.renderVerticalTexts({
      textList: texts.slice(0, topTextNum).slice(0, this.maxLineNumber),
      x: paddingX * this.unitSize,
      y: paddingY * this.unitSize,
      width: this.width - paddingX * 2 * this.unitSize,
      fontSize: fontSize * this.unitSize,
      firstIsBold: true,
    });
    this.renderVerticalTexts({
      textList: texts.slice(topTextNum).slice(0, this.maxLineNumber),
      x: qrPos === 'left' ? (paddingX + codeSize + 2) * this.unitSize : paddingX * this.unitSize,
      y: (paddingY + fontSize * topTextNum) * this.unitSize,
      width: this.width - paddingX * 2 * this.unitSize - (codeSize + 2) * this.unitSize,
      fontSize: fontSize * this.unitSize,
      firstIsBold: topTextNum === 0,
    });
    const qrDataUrl = genQrDataURL({ value: url, correctLevel });

    if (qrDataUrl) {
      await this.drawImageUrl(qrDataUrl, {
        x: qrPos === 'left' ? paddingX * this.unitSize : this.width - (paddingX + codeSize) * this.unitSize,
        y:
          size === 'l'
            ? (this.height - codeSize * this.unitSize) / 2
            : (paddingY + fontSize * topTextNum + 2) * this.unitSize,
        width: codeSize * this.unitSize,
        height: codeSize * this.unitSize,
      });
    }
  }
}

window['QrLabel'] = QrLabel;
