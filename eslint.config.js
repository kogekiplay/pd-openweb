const prettier = require('eslint-plugin-prettier');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const js = require('@eslint/js');
const globals = require('globals');
const babelParser = require('@babel/eslint-parser');

const reactHooksRecommendedRules = Object.keys(reactHooks.configs.recommended.rules).reduce((rules, ruleName) => {
  rules[ruleName] = 'warn';
  return rules;
}, {});

module.exports = [
  js.configs.recommended,
  {
    ignores: [
      'src/library/*',
      'src/pages/calendar/modules/calendarControl/**',
      // 以下按具体文件名忽略的条目一律写成扩展名无关,否则 .js -> .ts 后 glob 失配、
      // 这些文件会突然被纳入 lint 并刷出大量既存报错
      'src/pages/integration/svgIcon.*',
      'src/pages/workflow/api/*',
      'src/pages/workflow/apiV2/*',
      'src/pages/Statistics/api/*',
      'src/pages/integration/api/*',
      'src/pages/widgetConfig/widgetSetting/components/DevelopWithAI/examples/**',
      'src/components/Mingo/ChatBot/components/Recorder/lib.*',
      'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/test/**',
    ],
  },
  {
    // .ts/.tsx 已纳入。不需要 typescript-eslint：@babel/eslint-parser 读项目 .babelrc，
    // 而 .babelrc 的 development/production 两个 env 都挂了 @babel/preset-typescript，
    // preset-typescript 按文件扩展名自动启用 TS 语法，所以 .ts/.tsx 能被正常解析。
    // （eslint 进程 NODE_ENV 为空时 babel 的 envName 默认就是 "development"。）
    // 注意这里只恢复了「语法层」的 lint 覆盖，拿不到类型感知规则
    //（no-unsafe-*、no-floating-promises 等）—— 那些需要 typescript-eslint + 类型信息。
    // 类型层的检查由 tsc 那条独立管线负责，不指望 eslint。
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      prettier,
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        File: false,
        _l: false,
        delCookie: false,
        getCookie: false,
        md: false,
        setCookie: false,
        wx: false,
        safeParse: false,
        safeLocalStorageSetItem: false,
        getCurrentLang: false,
        translations: false,
        __api_server__: false,
        // 构建期常量：CI/webpack.config.js 的 BUILD_CONSTANTS 经 DefinePlugin
        // 做文本替换注入，源码里没有声明处。同步登记在 types/global.d.ts。
        ENABLE_FASTGPT: false,
        FAST_GPT_CONFIG_BASE64: false,
        $: false,
        createTimeSpan: false,
        getCurrentLangCode: false,
        jQuery: false,
        IM: false,
        dd: false,
        mdyAPI: false,
        agentAPI: false,
        AMap: false,
        destroyAlert: false,
        blobStream: false,
        moxie: false,
        plupload: false,
        ActiveXObject: false,
        HWH5: false,
        WeixinJSBridge: false,
        google: false,
        TencentCaptcha: false,
        VConsole: false,
      },
    },

    rules: {
      // React rules
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'error',

      // React Hooks recommended rules run as warnings before React Compiler adoption.
      ...reactHooksRecommendedRules,

      // Prettier integration
      'prettier/prettier': 'error',

      // 解构时把某个属性单列出来、只为了让它不进 rest，是本仓剥离 prop 的常用写法
      //（例如 react-window 2 会额外塞 ariaAttributes 给格子组件，透传下去会落到 DOM 上）。
      // eslint 默认把这种"故意不用"的变量算作未使用，ignoreRestSiblings 就是为它设的。
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],

      'no-extra-boolean-cast': 'warn',
      'no-async-promise-executor': 'off',
      'no-loss-of-precision': 'off',
      'no-case-declarations': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-prototype-builtins': 'off',

      // 提高可维护性：在块语句、const/let 后要求空行
      'padding-line-between-statements': [
        'warn',
        // 块语句（if/for/while/switch/function 等）后面加空行
        { blankLine: 'always', prev: 'block-like', next: '*' },
        // const/let 声明后若紧跟块语句，中间加空行
        { blankLine: 'always', prev: ['const', 'let'], next: 'block-like' },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
