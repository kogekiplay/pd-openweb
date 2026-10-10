/** @mingdaocom/json-view 0.1.4, installed dist/index.js JsonPreview/JsonNode and README props table. */
declare module '@mingdaocom/json-view' {
  interface JsonViewProps {
    data: unknown;
    /** Rendered with String(displayKey), rather than as a React node. */
    rootKey?: unknown;
    bodyClassName?: string | undefined;
    copyData?: unknown;
    indentSize?: number | undefined;
    enableClipboard?: boolean | undefined;
    accentColor?: string | undefined;
    /** Known palettes: dark/light/transparent; all other strings use dark. */
    theme?: string | undefined;
    onCopy?: ((text: string, path: Array<string | number>) => void) | undefined;
    className?: string | undefined;
    showGuideLine?: boolean | undefined;
  }
  const JsonView: import('react').ComponentType<JsonViewProps>;
  export default JsonView;
}
