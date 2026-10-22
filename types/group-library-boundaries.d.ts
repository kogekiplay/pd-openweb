import 'lodash';

/** lodash union filters primitive strings before flattening; the third scalar is not an iteratee. */
declare module 'lodash' {
  interface LoDashStatic {
    union<T>(first: readonly T[], second: readonly T[], ignoredScalar: string): T[];
  }
}
