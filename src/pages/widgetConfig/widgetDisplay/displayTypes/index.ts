import { exportRelevantComponents } from '../../util';

// 后缀无关：本目录 .js/.jsx/.ts/.tsx 混杂（不含 JSX 的展示项会被判定成 .ts）。
// (?!index\.) 不可省略——扫描的是自身所在目录，否则 index 会把自己注册进来并自引用。
export default exportRelevantComponents(require.context('./', false, /^\.\/(?!index\.)[^/]+\.[jt]sx?$/));
