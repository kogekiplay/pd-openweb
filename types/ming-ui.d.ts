// ming-ui 的三个「桶」路径在磁盘上没有 index 文件：
//   src/ming-ui/{,antd-components/,functions/} 下都只有子目录，没有 index.js。
// 运行时能 `import { Icon } from 'ming-ui'` 完全靠 .babelrc 的 babel-plugin-import
// 在 babel 层把它重写成 `ming-ui/components/Icon`（裸 'ming-ui' 从不到达 webpack
// resolver）。tsc 没有等价机制，tsconfig 的 paths 会把它指向一个无 index 的目录，
// 于是必然 TS2307。
//
// 这里用 shorthand ambient module 解封。代价：这三个说明符导出的东西全是 any。
// 刻意【不】在 src/ming-ui 下补真 barrel —— 那会让 babel-plugin-import 的按需加载
// 失效（'ming-ui' 变成真模块后整个组件库被拉进首屏 bundle）。
//
// 深层路径（ming-ui/components/Icon 等）不在此列：它们有真实目录 + index，
// tsconfig 的 "ming-ui/*" paths 能正常解析，无需声明。
declare module 'ming-ui';
declare module 'ming-ui/antd-components';
declare module 'ming-ui/functions';
