import QRCode from '@mdfe/qrcode-base';
import JsBarcode from 'jsbarcode';
import loadScript from 'load-script';
import localForage from 'localforage';
import _, { get } from 'lodash';
import {
  BAR_POSITION,
  LANDSCAPE_QR_CODE_SIZE,
  PORTRAIT_QR_CODE_SIZE,
  PRINT_TYPE,
  QR_LABEL_SIZE,
  QR_LABEL_SIZES,
  QR_LAYOUT,
  QR_POSITION,
} from 'worksheet/common/PrintQrBarCode/enum';

export const QRErrorCorrectLevel = {
  L: 1, // 7%
  M: 0, // 15%
  Q: 3, // 25%
  H: 2, // 30%
};

/** doc.text() / doc.widthOfString() 的排版选项，键取自本文件实际传的那几个。 */
/** JsBarcode 的 CODE128 编码结果，只用到 data（由 0/1 组成的条纹串）。 */
export interface Code128Encoding {
  data: string;
}

export interface PdfTextOptions {
  align?: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
  lineBreak?: boolean;
}

/** new PDFDocument(...) 的构造配置，键取自 init() 实际传的那几个。 */
export interface PdfDocumentConfig {
  /** [宽, 高]，单位 pt */
  size?: [number, number];
  /** 传 null 表示不预载内置字体，字体由 loadFont() 自己 registerFont */
  font?: string | null;
  info?: { Title?: string; Author?: string };
}

/**
 * pdfkit 文档对象的最小形状。
 *
 * pdfkit 是 init() 里用 <script> 从 /staticfiles/pdf/pdfkit.standalone.min.js 现加载的
 *（挂在 window.PDFDocument 上），没有随包的类型声明，npm 上的 @types/pdfkit 描述的是
 * Node 版、与这个 standalone 构建对不上。所以这里只声明【本文件实际用到的那 16 个成员】，
 * 不求完整 —— 用到新方法时在这里补一行，比写 any 更能暴露拼写错误。
 *
 * 绘图类方法统一返回自身：pdfkit 的 API 就是链式的，本文件也这么用
 * （this.doc.strokeColor(c).lineWidth(0.1).moveTo(0, top).lineTo(width, top).stroke()）。
 * widthOfString 返回宽度、pipe 返回流，是仅有的两个例外。
 */
export interface PdfDoc {
  pipe(destination: PdfBlobStream): PdfBlobStream;
  addPage(): PdfDoc;
  end(): void;
  registerFont(name: string, src: ArrayBuffer): PdfDoc;
  font(name: string): PdfDoc;
  fontSize(size: number): PdfDoc;
  text(value: string, x?: number, y?: number, options?: PdfTextOptions): PdfDoc;
  widthOfString(value: string, options?: PdfTextOptions): number;
  rect(x: number, y: number, width: number, height: number): PdfDoc;
  fill(color?: string): PdfDoc;
  fillColor(color: string): PdfDoc;
  stroke(): PdfDoc;
  strokeColor(color: string): PdfDoc;
  lineWidth(width: number): PdfDoc;
  moveTo(x: number, y: number): PdfDoc;
  lineTo(x: number, y: number): PdfDoc;
}

/** blob-stream 的返回值，只用到取最终 Blob 这一步（见 getBlobUrl）。 */
export interface PdfBlobStream {
  on(event: string, handler: () => void): void;
  toBlob(type?: string): Blob;
  toBlobURL(type?: string): string;
}

/** 标签上的一行文本。renderTexts 会把整个对象展开，所以允许携带自己的排版覆盖项。 */
export interface LabelText {
  text?: string;
  value?: string;
  align?: 'left' | 'center' | 'right';
  isBold?: boolean;
}

/** 一张标签要打印的内容：码里承载的值 + 标签上的文本行。 */
export interface LabelRecord {
  value: string;
  texts: LabelText[];
}

/**
 * 标签打印配置。键名取自调用点实际读写的那些（含从 this.options 解构出来的），
 * 数值类字段对应 enum.ts 里的枚举（QR_LAYOUT / QR_LABEL_SIZE / PRINT_TYPE / QR_POSITION），
 * 那几个枚举的值都是 number，所以这里就是 number，不另造联合类型 ——
 * 造了也拦不住什么，enum.ts 里是普通对象字面量而非 as const。
 */
export interface LabelOptions {
  width?: number;
  height?: number;
  layout?: number;
  labelSize?: number;
  printType?: number;
  position?: number;
  codeSize?: number | string;
  codeFaultTolerance?: number;
  fontSize?: number;
  firstIsBold?: boolean;
  showBarValue?: boolean;
  printData?: LabelRecord[];
  /** 加载字体时的进度提示；传 undefined 表示结束 */
  onProgress?: (message?: string) => void;
}

const defaultOptions = {
  gap: 0,
  render: 'canvas',
  width: 256,
  height: 256,
  typeNumber: -1,
  correctLevel: QRErrorCorrectLevel.M,
  background: '#ffffff',
  foreground: '#000000',
  setFillColor: () => {},
  rect: () => {},
  renderCell: () => {},
};

const renderQr = function (options) {
  options = Object.assign({}, defaultOptions, options);
  const qrcode = new QRCode(options.typeNumber, options.correctLevel);
  qrcode.addData(options.value);
  qrcode.make();
  const tileW = (options.width - options.gap * 2) / qrcode.getModuleCount();
  const tileH = (options.height - options.gap * 2) / qrcode.getModuleCount();

  for (let row = 0; row < qrcode.getModuleCount(); row++) {
    for (let col = 0; col < qrcode.getModuleCount(); col++) {
      // const w = Math.ceil((col + 1) * tileW) - Math.floor(col * tileW);
      // const h = Math.ceil((row + 1) * tileH) - Math.floor(row * tileH);
      // const w = tileW;
      // const h = tileH;
      options.renderCell({
        x: Math.round(col * tileW * 100) / 100 + options.gap,
        y: Math.round(row * tileH * 100) / 100 + options.gap,
        w: Math.round(tileW * 100) / 100,
        h: Math.round(tileH * 100) / 100,
        isDark: qrcode.isDark(row, col),
        color: qrcode.isDark(row, col) ? options.foreground : options.background,
      });
    }
  }
};

function mmToPt(mm) {
  return mm * 2.83464567;
}

// 按 PDF 内嵌字体的真实宽度切行
// 不能用浏览器 DOM/canvas 的 sans-serif 度量：sans-serif 在 mac（Helvetica/苹方）和 windows（Arial/微软雅黑）
// 解析成不同字体，与内嵌的阿里巴巴普惠体宽度也不一致，切行点会跨平台漂移，
// 切出的行再被 PDFKit 按真实宽度二次折行，就会出现多余换行和错乱行距
function cutTextByWidth(doc, text = '', maxWidth) {
  const result = [];
  let tempText = '';

  for (let i = 0; i < text.length; i++) {
    const nextText = tempText + text[i];

    if (tempText && doc.widthOfString(nextText) > maxWidth) {
      result.push(tempText);
      tempText = text[i];
    } else {
      tempText = nextText;
    }
  }

  result.push(tempText);
  return result;
}

export default class Label {
  // 这些字段都只在构造函数或 init()/setLayout() 里用 this.x = ... 赋值。
  // TS 不把构造函数里的赋值当作字段声明，所以不写这几行的话，
  // 每一次读取都报 TS2339「Property 'x' does not exist on type 'Label'」——
  // 本文件因此产生 147 条诊断。
  //
  // 用 declare 而不是普通字段声明：declare 是纯类型声明，babel 的 TS preset 会整行擦除，
  // 不会生成 `this.x = undefined` 这种类字段初始化，对运行时零影响。
  declare options: LabelOptions;
  declare PDFDocument: new (config: PdfDocumentConfig) => PdfDoc;
  declare doc: PdfDoc;
  declare stream: PdfBlobStream;
  /** 画尺寸的基准单位，init() 里按 min(width,height)/30 算出 */
  declare unitSize: number;
  /** 码的档位，取自 enum.ts 的 shorts 表（'s' | 'm' | 'l' | 'h'，但那张表是普通对象字面量，类型只到 string） */
  declare size: string;
  declare paddingX: number;
  declare paddingY: number;
  declare fontSize: number;
  declare codeSize: number;
  declare topTextNum: number;
  declare barHeight: number;
  /** 打开后会画出辅助线框，见 drawLine / drawRect */
  declare isDebug: boolean;

  constructor(options: LabelOptions = {}) {
    this.options = Object.assign(
      {
        width: 80,
        height: 100,
      },
      options,
    );
    // this.isDebug = true;
  }
  async loadScript(src: string) {
    return new Promise(resolve => {
      loadScript(src, {}, resolve);
    });
  }
  async init() {
    const { width, height, printType } = this.options;
    this.setLayout();
    this.unitSize = Math.min(width, height) / 30;
    await this.loadScript('/staticfiles/pdf/pdfkit.standalone.min.js');
    await this.loadScript('/staticfiles/pdf/blob-stream.js');
    this.PDFDocument = window.PDFDocument;
    this.doc = new this.PDFDocument({
      size: [mmToPt(width), mmToPt(height)], // width, height
      font: null,
      info: {
        Title: printType === PRINT_TYPE.QR ? _l('打印二维码') : _l('打印条形码'),
        Author: _l('HAP'),
      },
    });
    this.stream = this.doc.pipe(blobStream());
    await this.loadFont();
  }
  setLayout() {
    const { labelSize, width, height } = this.options;

    if (labelSize === QR_LABEL_SIZE.CUSTOM) {
      this.options.layout = width > height ? QR_LAYOUT.LANDSCAPE : QR_LAYOUT.PORTRAIT;
    }

    const { layout } = this.options;
    this.size = (layout === QR_LAYOUT.PORTRAIT ? PORTRAIT_QR_CODE_SIZE : LANDSCAPE_QR_CODE_SIZE).shorts[
      Number(this.options.codeSize)
    ];
    this.paddingX = 3;
    this.paddingY = 2;
    this.fontSize = 5 * (this.options.fontSize || 1);
    if (layout === QR_LAYOUT.PORTRAIT) {
      this.codeSize = {
        s: 11,
        m: 16,
        l: 20,
        h: 24,
      }[this.size];
    } else {
      this.codeSize = {
        s: 13,
        m: 16,
        l: 20,
        h: 24,
      }[this.size];
    }

    this.topTextNum = {
      s: 2,
      m: 1,
      l: 0,
      h: 0,
    }[this.size];
    this.barHeight =
      (width > height
        ? {
            l: 18,
            m: 14,

            s: 9,
          }
        : {
            l: 19,
            m: 14,
            s: 9,
          })[['l', 'm', 's'][Number(this.options.codeSize) - 1]] * 0.9;
  }
  async loadFont() {
    const { onProgress = () => {} } = this.options;
    const { doc } = this;

    async function load(fontKey: string, fontName: string, fontUrl: string) {
      const savedFont = await localForage.getItem<ArrayBuffer>(fontKey);

      if (savedFont) {
        doc.registerFont(fontName, savedFont);
      } else {
        onProgress(_l('正在加载字体，同一个浏览器只需要加载一次'));
        const font = await fetch(fontUrl);
        const fontArrayBuffer = await font.arrayBuffer();
        localForage.setItem(fontKey, fontArrayBuffer);
        doc.registerFont(fontName, fontArrayBuffer);
      }
    }

    await load('regular_font', 'alibaba', '/staticfiles/fonts/regular.ttf');
    await load('bold_font', 'alibabaBold', '/staticfiles/fonts/bold.ttf');
    onProgress(undefined);
  }
  drawLine(top: number, width: number, color = 'red') {
    if (!this.isDebug) return;
    this.doc.strokeColor(color).lineWidth(0.1).moveTo(0, top).lineTo(width, top).stroke();
  }
  drawRect(left, top, width, height, color = 'green', lineWidth = 0.1) {
    if (!this.isDebug) return;
    this.doc.strokeColor(color).lineWidth(lineWidth).rect(left, top, width, height).stroke();
  }
  async render() {
    const { printType, printData } = this.options;
    await this.init();
    let isFirstPage = true;
    const printDataForPrint = [...printData];

    while (printDataForPrint.length) {
      const labelData = printDataForPrint.shift();

      if (!isFirstPage) {
        this.doc.addPage();
      }

      if (printType === PRINT_TYPE.QR) {
        this.renderQrLabel(labelData);
      } else if (printType === PRINT_TYPE.BAR) {
        this.renderBarLabel(labelData);
      }

      isFirstPage = false;
    }
  }
  renderQrLabel(labelData) {
    if (!labelData) return;
    const { width, position, layout, firstIsBold } = this.options;

    if (layout === QR_LAYOUT.PORTRAIT) {
      this.renderTexts(
        labelData.texts.map((item, i) => ({
          value: item.text,
          align: firstIsBold && i === 0 ? 'center' : 'left',
          isBold: firstIsBold && i === 0,
          ...item,
        })),
        {
          fontSize: mmToPt(this.fontSize * this.unitSize * 0.59),
          width: Math.ceil(mmToPt(width - this.paddingX * 2 * this.unitSize)),
          left: mmToPt(this.paddingX * this.unitSize),
          top: mmToPt(
            position === QR_POSITION.TOP
              ? (this.paddingY + this.codeSize + 2) * this.unitSize
              : this.paddingY * this.unitSize,
          ),
        },
      );
    } else {
      // maxLineNumber
      this.renderTexts(
        labelData.texts.slice(0, this.topTextNum).map((item, i) => ({
          value: item.text,
          isBold: firstIsBold && i === 0,
          ...item,
        })),
        {
          left: mmToPt(this.paddingX * this.unitSize),
          top: mmToPt(this.paddingY * this.unitSize),
          width: mmToPt(width - this.paddingX * 2 * this.unitSize),
          fontSize: mmToPt(this.fontSize * this.unitSize * 0.59),
        },
      );
      this.renderTexts(
        labelData.texts.slice(this.topTextNum).map((item, i) => ({
          value: item.text,
          isBold: firstIsBold && i === 0 && this.topTextNum === 0,
          ...item,
        })),
        {
          left: mmToPt(
            position === QR_POSITION.LEFT
              ? (this.paddingX + this.codeSize + 2) * this.unitSize
              : this.paddingX * this.unitSize,
          ),
          top: mmToPt((this.paddingY + 5 * this.topTextNum) * this.unitSize),
          width: mmToPt(width - this.paddingX * 2 * this.unitSize - (this.codeSize + 2) * this.unitSize),
          fontSize: mmToPt(this.fontSize * this.unitSize * 0.59),
        },
      );
    }

    this.renderQrCode(labelData.value);
  }
  renderBarCode(barValue) {
    if (!barValue) return;
    const { width, height, showBarValue, position } = this.options;
    let barFontSize = 1.8 * this.unitSize;
    let barTextHeight = 1.5 * barFontSize;
    let barHeight = this.barHeight * this.unitSize;

    function parseToCode128(value) {
      const parsed = JsBarcode({}, value, {
        format: 'CODE128',
      });
      return _.get(parsed, '_encodings.0.0') as Code128Encoding | undefined;
    }

    if (barValue && barValue.trim()) {
      const code128 = parseToCode128(barValue);

      // JsBarcode 取不到编码时这里原本会在 code128.data 上直接抛 TypeError。
      // 加守卫既消掉 TS18048，也把崩溃变成「这张标签不画条码」，
      // 与上面 if (barValue && barValue.trim()) 的防御风格一致。
      if (!code128) return;

      const barWidth = width - this.paddingX * this.unitSize * 2;
      let realBarWidth = barWidth;
      let leftOffset = 0;
      let barColumnWidth = barWidth / code128.data.length;

      if (barColumnWidth > 0.5 * this.unitSize) {
        barColumnWidth = 0.5 * this.unitSize;
        realBarWidth = barColumnWidth * code128.data.length;
        leftOffset = (barWidth - realBarWidth) / 2;
      }

      code128.data.split('').forEach((char, i) => {
        const fillColor = char === '1' ? '#151515' : '#ffffff';
        this.doc
          .fillColor(fillColor)
          .rect(
            mmToPt(this.paddingX * this.unitSize + leftOffset + barColumnWidth * i),
            mmToPt(
              position === BAR_POSITION.TOP
                ? this.paddingY * this.unitSize
                : height - this.paddingY * this.unitSize - barHeight,
            ),
            mmToPt(barColumnWidth),
            mmToPt(barHeight),
          )
          .fill();
      });
      if (showBarValue) {
        const barTop =
          position === BAR_POSITION.TOP
            ? this.paddingY * this.unitSize + barHeight
            : height - this.paddingY * this.unitSize - barHeight - barTextHeight;
        this.doc
          .fillColor('#fff')
          .rect(mmToPt(this.paddingX * this.unitSize), mmToPt(barTop), mmToPt(barWidth), mmToPt(barTextHeight))
          .fill();
        this.doc
          .font('alibaba')
          .fontSize(mmToPt(barFontSize))
          .fillColor('#151515')
          .text(barValue, mmToPt(this.paddingX * this.unitSize), mmToPt(barTop), {
            width: mmToPt(barWidth),
            height: mmToPt(barTextHeight),
            align: 'center',
            lineBreak: true,
          });
      }
    }
  }
  renderBarLabel(labelData) {
    if (!labelData) return;
    const { position, width, showBarValue, firstIsBold } = this.options;
    // maxLineNumber
    let barFontSize = 1.8 * this.unitSize * 1.5;
    const textTop =
      position === BAR_POSITION.TOP
        ? this.paddingY * this.unitSize + this.barHeight * this.unitSize + (showBarValue ? barFontSize : 0)
        : this.paddingY * this.unitSize;
    this.drawLine(mmToPt(this.paddingY * this.unitSize), mmToPt(width));
    this.drawLine(mmToPt(this.paddingY * this.unitSize + this.barHeight * this.unitSize), mmToPt(width));
    this.renderTexts(
      labelData.texts.map((item, i) => ({
        value: item.text,
        align: firstIsBold && i === 0 ? 'center' : 'left',
        isBold: firstIsBold && i === 0,
        ...item,
      })),
      {
        left: mmToPt(this.paddingX * this.unitSize),
        top: mmToPt(textTop),
        width: mmToPt(width - this.paddingX * 2 * this.unitSize),
        fontSize: mmToPt(this.fontSize * this.unitSize * 0.59),
      },
    );
    this.renderBarCode(labelData.value);
  }
  renderTexts(texts = [], { left = 0, top = 0, fontSize = 10, color = '#151515', width = 100 } = {}) {
    const _this = this;
    this.drawLine(top, width);
    if (!texts.length) return;
    texts = texts.map(text => ({
      ...text,
      value: _.replace(text.value, /\n/g, ''),
    }));
    const { doc } = this;
    doc.fillColor(color);
    let textTop = top;

    function applyFont(isBold, size: number) {
      doc.font(isBold ? 'alibabaBold' : 'alibaba').fontSize(size);
    }

    function render(textsForRender) {
      textsForRender.forEach(text => {
        const { value, align = 'left', forceInLine, isBold } = text;
        let textFontSize = fontSize;
        applyFont(isBold, textFontSize);

        if (forceInLine) {
          const valueWidth = doc.widthOfString(value);

          if (valueWidth > width) {
            // 内嵌字体的字符宽度与字号严格成正比，按比例压缩即可一行放下，向下取整留出余量
            textFontSize = Math.floor(((textFontSize * width) / valueWidth) * 10) / 10;
            applyFont(isBold, textFontSize);
          }
        }

        const normalTextHeight = mmToPt((_this.fontSize * _this.unitSize) / (get(_this, 'options.fontSize') || 1));
        // 上面已按真实宽度切行 / 压缩字号，每段必定单行
        const textHeight = textFontSize * 1.5;
        // 传了 width 时 PDFKit 一定会走自动折行，这里改为不传 width、自行处理对齐，避免二次折行
        const textLeft = align === 'center' ? left + (width - doc.widthOfString(value)) / 2 : left;
        _this.drawRect(left, textTop, width, normalTextHeight);
        doc.text(value, textLeft, textTop + (normalTextHeight > textHeight ? (normalTextHeight - textHeight) / 2 : 0), {
          lineBreak: false,
        });
        textTop += normalTextHeight;
      });
    }

    texts.forEach(text => {
      let cutTexts;

      if (text.forceInLine) {
        cutTexts = [text];
      } else {
        applyFont(text.isBold, fontSize);
        cutTexts = cutTextByWidth(doc, text.value, width).map(t => ({
          ...text,
          value: t,
        }));
      }

      render(
        cutTexts.map(item => ({
          ...item,
          ...(cutTexts.length > 1 ? { align: 'left' } : {}),
        })),
      );
    });
  }
  getQrCodePosition() {
    const { layout, position, width, height } = this.options;
    let left, top;

    if (layout === QR_LAYOUT.PORTRAIT) {
      left = (width - this.codeSize * this.unitSize) / 2;
      top =
        position === QR_POSITION.TOP
          ? this.paddingY * this.unitSize
          : height - (this.paddingY + this.codeSize) * this.unitSize;
    } else {
      left =
        position === QR_POSITION.LEFT
          ? this.paddingX * this.unitSize
          : width - (this.paddingX + this.codeSize) * this.unitSize;
      top =
        this.size === 'l'
          ? (height - this.codeSize * this.unitSize) / 2
          : (this.paddingY + 5 * this.topTextNum + 2) * this.unitSize;
    }

    return {
      left,
      top,
      width: this.codeSize * this.unitSize,
      height: this.codeSize * this.unitSize,
    };
  }
  renderQrCode(qrValue) {
    if (!qrValue) return;
    const { codeFaultTolerance } = this.options;
    const { left, top, width, height } = this.getQrCodePosition();
    // this.doc
    //   .fillColor('#FFFFFF')
    //   .rect(
    //     mmToPt(left - this.paddingX * this.unitSize),
    //     mmToPt(top - this.paddingY * this.unitSize),
    //     layout === QR_LAYOUT.LANDSCAPE
    //       ? mmToPt(width + this.paddingX * this.unitSize)
    //       : mmToPt(width + this.paddingX * 2 * this.unitSize),
    //     mmToPt(height + this.paddingY * 2 * this.unitSize),
    //   )
    //   .fill();
    renderQr({
      value: qrValue,
      width: mmToPt(width),
      height: mmToPt(height),
      correctLevel: codeFaultTolerance || 1,
      renderCell: ({ x, y, w, h, isDark }) => {
        this.doc.rect(mmToPt(left) + x, mmToPt(top) + y, w, h);
        if (isDark) {
          this.doc.fill('#151515');
        } else {
          this.doc.fill('#fff');
        }
      },
    });
  }
  getBlobUrl(): Promise<string> {
    const stream = this.stream;
    // 必须显式写 Promise<string>：不写的话 new Promise(...) 推成 Promise<unknown>，
    // 一路传到 GeneratingPdf.tsx 的 setEmbedUrl(blobUrl) 报 TS2345。
    return new Promise<string>(resolve => {
      this.doc.end();
      stream.on('finish', function () {
        resolve(stream.toBlobURL('application/pdf'));
      });
    });
  }
}

/** 自定义尺寸时由调用方给出的宽高，其余键与 Label 的配置同形（下面直接展开给 Label）。 */
export interface GenerateLabelPdfConfig extends LabelOptions {
  labelCustomWidth?: number;
  labelCustomHeight?: number;
}

export async function generateLabelPdf(config: GenerateLabelPdfConfig = {}) {
  let width, height;

  if (config.labelSize === QR_LABEL_SIZE.CUSTOM) {
    width = config.labelCustomWidth;
    height = config.labelCustomHeight;
  } else {
    const configWidth = QR_LABEL_SIZES[config.labelSize].width;
    const configHeight = QR_LABEL_SIZES[config.labelSize].height;
    width = config.layout === QR_LAYOUT.LANDSCAPE ? configWidth : configHeight;
    height = config.layout === QR_LAYOUT.LANDSCAPE ? configHeight : configWidth;
  }

  const label = new Label({
    ...config,
    width,
    height,
  });
  await label.render();
  const blobUrl = await label.getBlobUrl();
  return blobUrl;
}
