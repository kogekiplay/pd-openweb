/** Browser code uses doT's runtime template compiler; template payloads remain unknown until decoded by callers. */
declare module 'dot' {
  interface Dot {
    template: (source: string, settings?: unknown, definitions?: unknown) => (data?: unknown) => string;
  }
  const dot: Dot;
  export default dot;
}
