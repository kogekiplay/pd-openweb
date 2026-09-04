module.exports = {
  printWidth: 120,
  trailingComma: 'all',
  singleQuote: true,
  arrowParens: 'avoid',
  jsxSingleQuote: false,
  semi: true,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    // react相关，支持子模块导入
    '^(react|react-dom|react-router-dom)(/.+)?$',
    // redux相关，支持子模块导入
    '^(redux|react-redux|redux-thunk)(/.+)?$',
    // react-库
    '^(@?react-).+',
    // 第三方组件库，支持子模块导入
    '^(antd|antd-mobile|@ant-design|@fullcalendar/react)(/.+)?$',
    'remarkable',
    'prismjs/components/prism-core',
    'prismjs/components/prism-clike',
    'prismjs/components/prism-javascript',
    // 剩余第三方库
    '<THIRD_PARTY_MODULES>',
    // ming-ui组件库，支持子模块导入
    '^(ming-ui)(/.+)?$',
    // API
    '.*/api/.*',
    // 指定业务模块
    '^(worksheet|mobile|statistics)',
    // 业务模块
    '^src/',
    // 父级导入，排除样式文件
    '^(../)+(?!.*.(?:css|less)$).*$',
    // 同级导入，排除样式文件
    '^./(?!.*.(?:css|less)$).*$',
    // 第三方样式（非相对路径）
    '^[^./].*\\.(css|less)$',
    // 样式文件
    '^.+.(?:css|less)$',
  ],
  // importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderCaseInsensitive: true,
  // 'typescript' 是 .ts/.tsx 迁移的硬前提：@trivago/prettier-plugin-sort-imports 用
  // @babel/parser 重新解析整个文件来排序 import，插件列表里没有 'typescript' 时，
  // 任何带类型注解的文件都会 SyntaxError 并让 prettier（以及 eslint 的 prettier/prettier）
  // 整个文件失败。实测：加之前 `prettier --check src/api/homeApp.ts` 报
  // `SyntaxError: Unexpected token, expected "," (25:27)`，加之后通过。
  // 与 'jsx' 并存是安全的：@babel/parser 允许同时启用，此时 `<T>expr` 按 JSX 解析，
  // 正是 .jsx/.tsx 需要的行为。
  importOrderParserPlugins: ['classProperties', 'decorators-legacy', 'jsx', 'typescript'],
};
