const prettier = require('eslint-plugin-prettier');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const js = require('@eslint/js');
const globals = require('globals');
const babelParser = require('@babel/eslint-parser');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

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
    // 公共规则与全局变量。JS/JSX 继续使用项目的 Babel parser，TS/TSX 在下面覆盖。
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
      // JSX 走 automatic runtime（.babelrc / tsconfig 的 jsx: react-jsx，2026-09-23 起），
      // 写 JSX 不再需要 React 在作用域里 —— 这两条是 classic runtime 专用的，开着会逼人加回无用的 import React
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/react-in-jsx-scope': 'off',
      // 2026-09-23 全仓清零（579 处）后打开；零容忍门禁是 bun run check:jsx-key，这里是给编辑器即时标红用的
      'react/jsx-key': ['error', { checkFragmentShorthand: true, warnOnDuplicates: true }],

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
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        experimentalDecorators: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // core no-undef 不理解声明文件中的类型/全局，TS 未定义标识符由 fast/strict
      // 的零容忍检查接管，不受历史基线或 strict 欠债清单豁免。
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // TS 的函数重载和类型/值同名声明是合法的，交给理解这些语法的扩展规则。
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
    },
  },
];
