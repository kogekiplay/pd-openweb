/**
 * styled-components 的类型下限 —— 只为「让模块可解析」，不为「启用类型检查」。
 *
 * 背景：本仓在 styled-components 4.4.1 时代【从未安装 @types/styled-components】，
 * 也就是说 `styled` 一直是隐式 any，1536 个使用它的文件从来没有被检查过 props。
 * 6.5.3 自带了完整的 TS 类型，一开就是 23869 → 29502 条原始诊断（+5633），
 * 门禁口径下 625 个新 key。
 *
 * 这些不是升级引入的 bug，而是「一批从未被类型覆盖的代码第一次被看见」。
 * 真正修它们（给每个 styled 组件声明 props 泛型）是一件独立的大工程，
 * 混进依赖升级会让这次改动无法审查 —— 所以这里把类型精度维持在升级前的状态。
 *
 * 试过但放弃的做法：用 codemod 给需要的声明逐个补 `<any>` 泛型。
 * 跑到第三轮已经插了 718 处、涉及约 500 个文件，仍剩 125 个新 key ——
 * diff 噪声远大于收益，而且每一处都是将来要逐个清理的类型债。
 * 一个文件的下限声明更诚实，也更好整体撤掉。
 *
 * 【怎么撤销】删掉本文件与 tsconfig.json 里那条 paths 映射，
 * v6 自带的类型就会立即生效，届时按上面说的分批补 props 泛型。
 *
 * 覆盖范围按实测的实际用法：默认导出 styled，具名导出只用到
 * keyframes(24 处) / css(12 处) / createGlobalStyle(5 处)；
 * ServerStyleSheet 只在 src/pages/AuthService/style.spec.js 里用。
 * 没有 .attrs / .withConfig / ThemeProvider / withTheme / css prop / 子路径导入。
 */
declare module 'styled-components' {
  // 标签模板调用的结果：一个什么 props 都收的组件。
  // 与升级前一致 —— 那时它就是 any。
  type StyledResult = any;

  interface StyledTemplate {
    (strings: TemplateStringsArray, ...interpolations: any[]): StyledResult;
    // 函数/对象调用形式：仓里有 45 处这么写，例如
    //   styled.div(({ hsList }) => `margin-top: ${!hsList ? 0 : -20}px;`)
    // 少了这条重载它们会全部报 TS2769（第一版 stub 就漏了这个）。
    (styles: ((props: any) => string) | Record<string, any> | string): StyledResult;
    // styled.div<Props>`...` 这种显式泛型的写法也要能过（仓里目前没有，
    // 但将来分批补 props 类型时会先出现在这里，别让它反而编译不过）
    <P>(strings: TemplateStringsArray, ...interpolations: any[]): StyledResult;
  }

  interface StyledInterface {
    (component: any): StyledTemplate;
    [tagName: string]: StyledTemplate;
  }

  const styled: StyledInterface;

  export default styled;
  export const css: (strings: TemplateStringsArray, ...interpolations: any[]) => any;
  export const keyframes: (strings: TemplateStringsArray, ...interpolations: any[]) => any;
  export const createGlobalStyle: (strings: TemplateStringsArray, ...interpolations: any[]) => any;
  export const ThemeProvider: any;
  export const StyleSheetManager: any;
  export const withTheme: any;
  export const useTheme: any;
  export class ServerStyleSheet {
    collectStyles(node: any): any;
    getStyleTags(): string;
    getStyleElement(): any;
    seal(): void;
  }
}
