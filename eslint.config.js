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
      'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/lib/**',
      'src/pages/widgetConfig/widgetSetting/components/FunctionEditorDialog/Func/test/**',
    ],
  },
  {
    // TODO(ts-pilot): 迁移到 .ts/.tsx 的文件目前会从「被 lint」静默变成「完全不被 lint」。
    // 未扩到 '**/*.ts'/'**/*.tsx' 是有意为之:本仓库没有安装 typescript-eslint
    // (node_modules/@typescript-eslint 不存在),下面的 parser 也仍是 @babel/eslint-parser,
    // 现在就扩会让 lint 直接跑崩、毁掉 lint 基线。补齐 parser 后再扩 files。
    files: ['**/*.js', '**/*.jsx'],
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
