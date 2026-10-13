declare module 'pdfobject' {
  interface PdfObject {
    embed(source: string | URL, target: Element | null): unknown;
  }
  const PDFObject: PdfObject;
  export default PDFObject;
}
