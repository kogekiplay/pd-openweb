/** Incremental migration bridge: actual installed declarations, same runtime/browser package. */
const runtime: typeof import('styled-components/dist/index') = require('styled-components');

export default runtime.default;
export const css: typeof runtime.css = runtime.css;
export const keyframes: typeof runtime.keyframes = runtime.keyframes;
export const createGlobalStyle: typeof runtime.createGlobalStyle = runtime.createGlobalStyle;
export const ServerStyleSheet: typeof runtime.ServerStyleSheet = runtime.ServerStyleSheet;
export type {
  CSSObject,
  CSSProp,
  DefaultTheme,
  ExecutionContext,
  Interpolation,
  RuleSet,
  StyledObject,
  StyleFunction,
} from 'styled-components/dist/index';
