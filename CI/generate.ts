import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';

const path: typeof import('path') = require('path');
const fs: typeof import('fs') = require('fs');
const moment: typeof import('moment') = require('moment');
const cheerio: typeof import('cheerio') = require('cheerio');
const minify: (html: string, options: Record<string, unknown>) => Promise<string> = require('html-minifier-terser').minify;
const lodash: Pick<typeof import('lodash'), 'isArray' | 'random'> = require('lodash');

interface HtmlEntry { type: string; src: string | null; origin: string }
interface CiUtils { htmlTemplatesPath: string; getEntryName(str: string, filename: string): string; getEntryFromHtml(filename: string, type?: string): HtmlEntry | undefined }
interface PublishConfig { apiServer: string; webpackPublicPath: string | readonly string[] }
type EntryNameFunction = (str: string, filename: string) => unknown;
type EntryFromHtmlFunction = (filename: string, type?: string) => unknown;
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isEntryNameFunction(value: unknown): value is EntryNameFunction {
  return typeof value === 'function';
}
function isEntryFromHtmlFunction(value: unknown): value is EntryFromHtmlFunction {
  return typeof value === 'function';
}
function optionalEntrySource(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new TypeError('Invalid CI HTML entry src');
}
function loadCiUtils(value: unknown): CiUtils {
  if (!isRecord(value) || typeof value['htmlTemplatesPath'] !== 'string' || !isEntryNameFunction(value['getEntryName']) || !isEntryFromHtmlFunction(value['getEntryFromHtml'])) {
    throw new TypeError('Invalid CI utility module');
  }
  const htmlTemplatesPath = value['htmlTemplatesPath'];
  const getEntryNameFunction = value['getEntryName'];
  const getEntryFromHtmlFunction = value['getEntryFromHtml'];
  return {
    htmlTemplatesPath,
    getEntryName(str, filename) {
      const result = getEntryNameFunction(str, filename);
      if (typeof result !== 'string') throw new TypeError('Invalid CI entry name');
      return result;
    },
    getEntryFromHtml(filename, type) {
      const result = getEntryFromHtmlFunction(filename, type);
      if (result === undefined) return undefined;
      if (!isRecord(result) || typeof result['type'] !== 'string' || (result['src'] !== null && typeof result['src'] !== 'string') || typeof result['origin'] !== 'string') {
        throw new TypeError('Invalid CI HTML entry');
      }
      return {
        type: String(result['type']),
        src: optionalEntrySource(result['src']),
        origin: String(result['origin']),
      };
    },
  };
}
function decodePublishConfig(value: unknown): PublishConfig {
  if (!isRecord(value) || typeof value['apiServer'] !== 'string') throw new TypeError('Invalid publish config');
  const publicPath = value['webpackPublicPath'];
  if (typeof publicPath !== 'string' && (!Array.isArray(publicPath) || !publicPath.every(item => typeof item === 'string'))) {
    throw new TypeError('Invalid webpack public path');
  }
  return { apiServer: value['apiServer'], webpackPublicPath: publicPath };
}
const ciUtils = loadCiUtils(require('./utils.ts'));
const { htmlTemplatesPath, getEntryName, getEntryFromHtml } = ciUtils;
const { apiServer, webpackPublicPath } = decodePublishConfig(require('./publishConfig.ts'));
const isProduction = process.env['NODE_ENV'] === 'production';
const buildPath = path.join(__dirname, '../build');
const htmlDestPath = path.join(__dirname, '../build/files');
const execSync: typeof import('child_process').execSync = require('child_process').execSync;
const version = execSync('git log --format="%H" -n 1').toString().trim();
const mainCommonEntries = ['node_modules', 'cookies', 'vendors', 'worksheet', 'common', 'globals'];

function getCommonEntries(type: string): readonly string[] {
  if (!isProduction) {
    return mainCommonEntries;
  }

  if (type === 'single') {
    return ['cookies', 'vendors', 'globals'];
  }

  if (type === 'singleExtractModules') {
    return ['node_modules', 'cookies', 'vendors', 'worksheet', 'common', 'globals'];
  }

  return mainCommonEntries;
}

function mkdir(dirPath: string): void {
  dirPath = path.resolve(__dirname, dirPath);
  if (fs.existsSync(dirPath)) {
    return;
  } else {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getPublicPath(type: string): string {
  if (!isProduction) {
    if (typeof webpackPublicPath !== 'string') throw new TypeError('Development public path must be a string');
    return webpackPublicPath;
  }

  const publicPath = lodash.isArray(webpackPublicPath)
    ? webpackPublicPath[lodash.random(0, webpackPublicPath.length - 1)]
    : webpackPublicPath;

  if (typeof publicPath !== 'string') throw new TypeError('Missing webpack public path');
  return type === 'index' ? publicPath : publicPath.replace('/dist/pack/', `/dist/${type}/pack/`);
}

async function destHtml(filename: string, html: string): Promise<void> {
  fs.writeFileSync(
    path.join(htmlDestPath, filename),
    isProduction
      ? await minify(html, {
          collapseWhitespace: true,
          minifyJS: { unused: 'keep_assign' },
        })
      : html,
  );
}

interface ManifestAsset { js?: string; css?: string }
type Manifest = Record<string, ManifestAsset>;
function decodeManifest(value: unknown): Manifest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid webpack manifest');
  const result: Manifest = {};
  for (const [key, rawAsset] of Object.entries(value)) {
    if (rawAsset === null || typeof rawAsset !== 'object' || Array.isArray(rawAsset)) throw new TypeError(`Invalid manifest entry: ${key}`);
    const data: Record<string, unknown> = {};
    for (const [field, fieldValue] of Object.entries(rawAsset)) data[field] = fieldValue;
    if (data['js'] !== undefined && typeof data['js'] !== 'string') throw new TypeError(`Invalid manifest js: ${key}`);
    if (data['css'] !== undefined && typeof data['css'] !== 'string') throw new TypeError(`Invalid manifest css: ${key}`);
    const outputAsset: ManifestAsset = {};
    if (typeof data['js'] === 'string') outputAsset.js = data['js'];
    if (typeof data['css'] === 'string') outputAsset.css = data['css'];
    result[key] = outputAsset;
  }
  return result;
}

async function generate(): Promise<void> {
  mkdir(htmlDestPath);
  for (const filename of fs.readdirSync(htmlTemplatesPath).filter((name: string) => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(htmlTemplatesPath, filename), 'utf8');
    const $: CheerioAPI = cheerio.load(html);
    const entry = getEntryFromHtml(filename);
    // 下面按条件往里挂 workflow / report / integration 等键，不标类型的话
    // 推出来只有 { main }，挂一个报一条 TS2339。
    const apiMap: Record<string, string> = {
      main: isProduction ? apiServer : '/api/',
    };

    if (!isProduction) {
      apiMap['workflow'] = '/workflow_api';
      apiMap['report'] = '/report_api';
      apiMap['integration'] = '/integration_api';
      apiMap['datapipeline'] = '/data_pipeline_api';
      apiMap['workflowPlugin'] = '/workflow_plugin_api';
      apiMap['knowledge'] = '/knowledge_api';
      apiMap['cloudapi'] = '/cloudapi_api';
    }

    $('head').prepend(`
      <meta name="format-detection" content="telephone=no, email=no, address=no">
      <link rel="icon" type="image/png" href="/favicon.png" />
      <style>
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-thumb {
          width: 6px;
          height: 6px;
          border-radius: 6px;
          background: rgba(187, 187, 187, 0.8);
          background-clip: padding-box;
          border: 2px solid transparent;
        }
        ::-webkit-scrollbar-thumb:active,
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(125, 125, 125, 0.8);
          background-clip: padding-box;
        }
        .pageLoader {
          animation: rotate 2s linear infinite;
          transform-origin: 50% 50%;
          display: inline-block;
        }
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      </style>
      <script>
        (function () {
          var freestyleVersion = Math.floor(Date.now() / 3600000);
          document.write('<link rel="stylesheet" href="/pm/freestyle.css?v=' + freestyleVersion + '" />');
          document.write('<script src="/pm/freestyle.js?v=' + freestyleVersion + '"><\\/script>');
        })();
      </script>
      <script>
          window.MDPublishVersion = "${version}";
          window.FE_RELEASE_TIME = "${moment().format('YYYY/MM/DD HH:mm:SS')}";
          window.isProduction = ${isProduction};
          var __api_server__ = eval(${JSON.stringify(apiMap)});
          var __webpack_public_path__ = "${entry ? getPublicPath(entry.type) : ''}";
          var urlPathname = new URL(location.href);
          var title = urlPathname.searchParams.get('pagetitle');
          var __customSubPath__ = '';

          if (window.__customSubPath__) {
            __api_server__.main = window.__customSubPath__ + __api_server__.main;
          }

          if (location.pathname.indexOf('/portal/') >= 0 || location.pathname.indexOf('/tpAuthPortal') >= 0) {
            window.subPath = window.__customSubPath__ + '/portal';
          }

          if (title) {
            document.title = decodeURIComponent(title);
          }
      </script>
    `);

    $('body').prepend(`
      <div id="app">
        <div style="position: absolute;top: 0; right: 0;bottom: 0; left: 0; display: flex;justify-content: center;align-items: center;">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 200 200" width="32" height="32" class="pageLoader" style="enable-background:new 0 0 200 200;" xml:space="preserve">
            <style type="text/css">
              .st0{fill:#BDBDBD;}
            </style>
            <path class="st0" d="M105.7,183.1c-45.9,3.2-85.7-31.4-89-77.3l19-1.3c2.5,35.4,33.2,62.1,68.6,59.6c35.4-2.5,62.1-33.2,59.6-68.6c-2.5-35.4-33.2-62.1-68.6-59.6l-1.3-19c45.9-3.2,85.7,31.4,89,77.3C186.2,140.1,151.6,179.9,105.7,183.1L105.7,183.1z"/>
          </svg>
        </div>
      </div>
    `);

    if (entry) {
      if (!entry.src) throw new TypeError(`Missing entry source in ${filename}`);
      const moduleName = getEntryName(entry.src, filename);
      const excludeArr = [
        'auth-workwx',
        'auth-workdd',
        'auth-chat-tools',
        'auth-welink',
        'auth-feishu',
        'auth-microsoft',
        'auth-dingding',
        'sso-dingding',
        'sso-sso',
        'sso-workweixin',
        'widget-container',
        'free-field-sandbox',
      ];
      const noCommonResource = excludeArr.some(key => moduleName.includes(key));

      if (!noCommonResource) {
        $('head').append(`
          <script>
            if (
              navigator.userAgent.toLowerCase().match(/(msie\\s|trident.*rv:)([\\w.]+)/) ||
              (navigator.userAgent.toLowerCase().match(/(chrome)\\/([\\w.]+)/) && parseInt(navigator.userAgent.toLowerCase().match(/(chrome)\\/([\\w.]+)/)[2]) < 50)
            ) {
              location.href = '/pm/browserupgrade';
            }
            this.globalThis || (this.globalThis = this)
          </script>
          <script src="/staticfiles/staticLanguages.js"></script>
        `);
      }

      if (moduleName.startsWith('free-field-sandbox')) {
        $('head').append(
          `<script src="${
            isProduction ? getPublicPath('index').replace('dist/pack/', '') : '/'
          }staticfiles/tailwindcss.js"/>`,
        );
      }

      const $entryScript = $('script')
        .filter((_i: number, node: Element) => $(node).attr('src') === entry.origin)
        .eq(0);

      if (!$entryScript[0]) {
        await destHtml(filename, $.html());
        continue;
      }

      if (!isProduction) {
        // 开发模式
        $entryScript.replaceWith(
          ['runtime', ...getCommonEntries(entry.type), moduleName]
            .map(src => `<script src="${getPublicPath(entry.type) + src}.dev.js"></script>`)
            .join(''),
        );
      } else {
        // 发布模式
        const baseEntry = ['runtime', ...getCommonEntries(entry.type)];

        const manifestData: Manifest = decodeManifest(JSON.parse(
          fs
            .readFileSync(path.join(buildPath, `dist/${entry.type === 'index' ? '' : `${entry.type}/`}manifest.json`))
            .toString(),
        ));

        $entryScript.replaceWith(
          [...(!noCommonResource ? baseEntry : ['runtime', 'cookies']), moduleName]
            .filter(key => !!manifestData[key] && manifestData[key].js)
            .map(key => {
              const asset = manifestData[key];
              return asset?.js ? `<script src="${getPublicPath(entry.type) + asset.js}"></script>` : '';
            })
            .join(''),
        );

        if (!noCommonResource) {
          $('head').append(
            ['css', ...baseEntry, moduleName]
              .filter(key => !!manifestData[key] && manifestData[key].css)
              .map(key => {
                const asset = manifestData[key];
                return asset?.css ? `<link rel="stylesheet" href="${getPublicPath(entry.type) + asset.css}" />` : '';
              })
              .join(''),
          );
        }
      }

      await destHtml(filename, $.html());
    } else {
      await destHtml(filename, $.html());
    }
  }
}

module.exports = generate;
