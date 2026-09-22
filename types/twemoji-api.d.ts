/**
 * `@twemoji/api` 的模块声明。
 *
 * 【为什么要我们自己写】这个包自带 index.d.ts，但里面声明的是
 * `declare module 'twemoji'`（旧包名）—— 作者把它当 twemoji 的 drop-in 替代，
 * 期望消费者用别名把 'twemoji' 指过来。我们是直接按新包名 import 的，
 * 于是 TS 解析到 index.d.ts 却找不到默认导出，报
 * "Property 'parse' does not exist on type 'typeof import(...)'"。
 *
 * 【为什么不用别名绕】给 webpack + tsconfig 各加一条 'twemoji' -> '@twemoji/api'
 * 的别名，等于在两处配置里埋一个「这个包其实是那个包」的隐形跳转，
 * 后来人按 import 去 node_modules 会扑空。直接按真名声明更直白。
 *
 * 签名照抄包内 index.d.ts，只是挂到正确的模块名上。
 * 【升级这个包时要回来看一眼】如果哪天它自己补了正确的模块名声明，
 * 这个文件就该删掉 —— 留着会盖住上游更准的类型。
 */
declare module '@twemoji/api' {
  /** 每找到一个 emoji 就回调一次；返回 falsy 表示这个 emoji 不做替换 */
  type ParseCallback = (icon: string, options: object, variant: string) => string | false;

  interface TwemojiOptions {
    /** 图片前缀，默认走官方 CDN */
    base?: string;
    /** 扩展名，默认 .png */
    ext?: string;
    /** 生成的 <img> 上的类名，默认 emoji */
    className?: string;
    /** 尺寸目录，默认 '72x72'；给数字会被规范化成 '<n>x<n>' */
    size?: string | number;
    /** 用 SVG 渲染时传 folder: 'svg' 配合 ext: '.svg' */
    folder?: string;
    callback?: ParseCallback;
    attributes?(icon: string, variant: string): object;
  }

  interface Twemoji {
    convert: {
      fromCodePoint(hexCodePoint: string): string;
      toCodePoint(utf16surrogatePairs: string, sep?: string): string;
    };
    parse<T extends string | HTMLElement>(node: T, options?: TwemojiOptions | ParseCallback): T;
    replace(text: string, replacer: string | ((...args: any[]) => string)): string;
    test(text: string): boolean;
  }

  const twemoji: Twemoji;
  export default twemoji;
  export type { TwemojiOptions, ParseCallback };
}
