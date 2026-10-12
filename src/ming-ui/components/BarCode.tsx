import { Component } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value?: string | undefined;
  renderer?: 'svg' | 'canvas' | 'img' | undefined;
  format?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  displayValue?: boolean | undefined;
  textAlign?: string | undefined;
  textPosition?: string | undefined;
  textMargin?: number | undefined;
  fontSize?: number | undefined;
  background?: string | undefined;
  lineColor?: string | undefined;
  margin?: number | undefined;
  marginTop?: number | undefined;
  marginBottom?: number | undefined;
  renderWidth?: number | undefined;
}

type BarcodeElement = SVGSVGElement | HTMLCanvasElement | HTMLImageElement | null;

export default class Barcode extends Component<BarcodeProps> {
  declare barcode: BarcodeElement;

  static defaultProps = {
    format: 'CODE128',
    renderer: 'svg',
    width: 2,
    height: 100,
    displayValue: true,
    textAlign: 'center',
    textPosition: 'bottom',
    textMargin: 5,
    fontSize: 15,
    background: '#ffffff',
    lineColor: '#000000',
    margin: 10,
    marginTop: 0,
    renderWidth: 160,
  };

  constructor(props: BarcodeProps) {
    super(props);
    this.update = this.update.bind(this);
  }

  override componentDidMount() {
    if (this.props.renderWidth && this.barcode) {
      (this.barcode as unknown as { width: number }).width = this.props.renderWidth;
    }

    this.update();
  }

  override componentDidUpdate() {
    this.update();
  }

  handleBarcode = (r: BarcodeElement) => {
    this.barcode = r;
  };

  update() {
    const {
      value,
      format,
      width,
      height,
      displayValue,
      textAlign,
      textPosition,
      textMargin,
      fontSize,
      background,
      margin,
      lineColor,
      marginBottom,
    } = this.props;

    JsBarcode(this.barcode, value || '', {
      format,
      width,
      height,
      displayValue,
      textAlign,
      textPosition,
      textMargin,
      fontSize,
      background,
      margin,
      lineColor,
      marginBottom,
    } as JsBarcode.Options);
  }

  override render() {
    const { renderer } = this.props;

    if (renderer === 'svg') {
      return <svg ref={this.handleBarcode} />;
    } else if (renderer === 'canvas') {
      return <canvas ref={this.handleBarcode} />;
    } else if (renderer === 'img') {
      return <img ref={this.handleBarcode} alt="" />;
    }
    return undefined;
  }
}
