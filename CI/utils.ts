import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import type { Configuration, Stats, StatsAsset, StatsCompilation } from 'webpack';
import type { ChalkInstance } from 'chalk';

const path: typeof import('path') = require('path');
const fs: typeof import('fs') = require('fs');
const crypto: typeof import('crypto') = require('crypto');
const readline: typeof import('readline') = require('readline');
const cheerio: typeof import('cheerio') = require('cheerio');
const lodash: Pick<typeof import('lodash'), 'cloneDeep' | 'trim'> = require('lodash');
const webpack: typeof import('webpack') = require('webpack');
interface MinimistResult { [key: string]: unknown }
const minimist: (args: readonly string[]) => MinimistResult = require('minimist');
const dayjs: typeof import('dayjs') = require('dayjs');
const axios: typeof import('axios') = require('axios');
interface NotifierOptions { [key: string]: unknown; sound?: boolean; title?: string; message?: string }
interface Notifier { notify(options: NotifierOptions): void }
const notifier: Notifier = require('node-notifier');
// chalk 5+ 是纯 ESM。Node 22 起 require(esm) 已稳定（本仓 engines 要求 >=26.8.1），
// 所以 require 本身没问题，但拿到的是 ESM 命名空间对象，着色函数在 .default 上。
// 少写 .default 的表现是 `chalk.xxx is not a function`，不是 require 报错。
//
// supportsColor 要另外拿：chalk 4 里它挂在 chalk 对象上（chalk.supportsColor），
// chalk 5+ 把它改成了【模块级具名导出】，default 上没有这个属性（值会是 undefined）。
// 两版的取值形状一致（false 或 {level, hasBasic, ...}），所以下面 webpack
// stats.toString({ colors }) 的真值语义不变。
const chalkModule: { default: ChalkInstance; supportsColor?: unknown } = require('chalk');
const chalk = chalkModule.default;
const supportsColor = chalkModule.supportsColor;

const isProduction = process.env['NODE_ENV'] === 'production';
const argv = minimist(process.argv.slice(2));
const verbose = Boolean(argv['verbose']);

const htmlTemplatesPath = path.join(__dirname, '../src/html-templates');

type PathValue = string | PathValue[] | { [key: string]: PathValue };
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isPathValue(value: unknown): value is PathValue {
  return typeof value === 'string' || Array.isArray(value) && value.every(isPathValue) || isRecord(value) && Object.values(value).every(isPathValue);
}
function wrapPathBase(base: string, relativePath: PathValue): PathValue {
  if (typeof relativePath === 'string') {
    return path.resolve(base, relativePath);
  }

  if (isRecord(relativePath)) {
    const newPaths: Record<string, PathValue> = {};

    for (const key in relativePath) {
      if (Object.prototype.hasOwnProperty.call(relativePath, key)) {
        const value = relativePath[key];
        if (!isPathValue(value)) throw new Error(`Invalid path parameter: ${String(value)}`);
        newPaths[key] = wrapPathBase(base, value);
      }
    }

    return newPaths;
  }

  if (Array.isArray(relativePath)) {
    return relativePath.map(rpath => wrapPathBase(base, rpath));
  }

  throw new Error(`Invalid path parameter: ${relativePath}`);
}

function notify(title: string, message: string, isError: boolean, extra: NotifierOptions = {}): void {
  const text = message.slice(0, isError ? 1000 : 100);
  const options = {
    ...extra,
    sound: isError,
    title,
    message: text,
  };

  // 桌面通知失败不该污染构建日志：node-notifier 自带的 terminal-notifier 二进制
  // 是 x86_64 的，在 arm64 mac 上 spawn 直接 EBADARCH，于是每次 webpack 编译完
  // 都会打出一整坨栈 —— 那坨栈是【这里自己打的】，catch 一直是有效的。
  // 通知本来就是锦上添花，降成一行提示。
  try {
    notifier.notify(options);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`Notifier failed: ${detail}`);
  }

  if (isError) {
    console.log(chalk.red(text));
  }
}

const webpackCompile = (err: Error | null | undefined, stats: Stats): void => {
  if (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    error.name = 'WebpackError';
    throw error;
  }

  stats.compilation.warnings = stats.compilation.warnings.filter((warning: Error) => {
    // Webpack attaches the source-map detail as a non-standard `details`
    // property. Keep the old filter's field and coercion semantics while
    // reading it through an own/inherited-property guard.
    const details = 'details' in warning ? String(warning.details) : 'undefined';
    return !/Failed to parse source map/.test(details);
  });

  const output = stats.toString({
    colors: Boolean(supportsColor),
    hash: verbose,
    version: verbose,
    timings: verbose,
    chunks: verbose,
    chunkModules: verbose,
    cached: verbose,
    cachedAssets: verbose,
    children: false,
  });

  console.log('[webpack]', output);

  /* 这里原先还有一段 console.log(chalk.yellow(json.warnings.join('\n')))。webpack 5 的 toJson().warnings
     是 { message, ... } 对象不是字符串，每次编译完终端里就多出几行黄色的 [object Object]；
     而这些告警上面的 stats.toString 已经完整打印过一遍（WARNING in ...），不需要再印。 */
  const json: StatsCompilation = stats.toJson({
    all: false,
    errors: true,
    warnings: true,
    assets: true,
    children: true,
  });

  const errors = json.errors || [];
  const isError = errors.length > 0;
  let title;
  let message;

  if (isError) {
    message = [...new Set(errors.map(error => lodash.trim(error.message)))].join('\n');
    title = 'Webpack Error';
  } else {
    const allAssets: StatsAsset[] = (json.assets || []).concat(...(json.children || []).map(stat => stat.assets || []));
    const emittedAssets = allAssets.filter(asset => asset.emitted && typeof asset.name === 'string');

    const jsFileCount = emittedAssets.filter(asset => asset.name.endsWith('.js')).length;
    const mapFileCount = emittedAssets.filter(asset => asset.name.endsWith('.map')).length;

    title = `Generated ${jsFileCount} JS file(s), ${mapFileCount} map file(s)`;
    message = emittedAssets
      .map(asset => asset.name)
      .join(',')
      .substring(0, 80);
  }

  notify(title, message, isError);
};

const webpackTaskFactory = (webpackConfigArg: Configuration, isWatch = false): ((callback: (error?: Error) => void) => void) => {
  const webpackConfig = lodash.cloneDeep(webpackConfigArg);

  return (callback: (error?: Error) => void): void => {
    const webpackCompiler = webpack(webpackConfig);
    const finish = (error?: Error): void => {
      if (isWatch || !webpackCompiler.close) {
        callback(error);
        return;
      }

      webpackCompiler.close((closeError: Error | null) => {
        callback(error || closeError || undefined);
      });
    };

    const compile = (err: Error | null, stats?: Stats): void => {
      try {
        if (!stats) throw err || new Error('Webpack did not return stats');
        webpackCompile(err, stats);
        if (isProduction && stats.hasErrors()) {
          finish(new Error('Webpack compilation failed'));
          return;
        }

        finish();
      } catch (error: unknown) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (isWatch) {
      webpackCompiler.watch({ aggregateTimeout: 200 }, compile);
    } else {
      webpackCompiler.run(compile);
    }
  };
};

interface RewriteRule { match: string; redirect: string; ignoreCase: boolean }
type RewriteData = Record<string, string | number | boolean | null | undefined>;
function parseNginxRewriteConf(confPathList: readonly string[], data: RewriteData = {}): RewriteRule[] {
  const content =
    confPathList.map(confPath => fs.readFileSync(confPath).toString()).join('\n') +
    '\nrewrite (?i)^/portallogin /portalLogin.html break;\nrewrite (?i)^/portalTpauth /portalLogin.html break;';

  return content
    .split(/\r?\n/)
    .filter(rule => rule && /^rewrite(.*)break;/.test(rule))
    .map((rule: string): RewriteRule => {
      const parts = rule.replace(/ +/g, ' ').split(' ');
      if (parts.length < 4 || !parts[1] || !parts[2]) throw new TypeError(`Invalid rewrite rule: ${rule}`);
      return {
        match: parts[1].replace('(?i)', ''),
        redirect: parts[2].replace(/\${(.*?)}/g, (_match: string, key: string) => String(data[key] || '')),
        ignoreCase: parts[1].includes('(?i)'),
      };
    });
}

function getEntryName(str: string, filename: string): string {
  return `${path.parse(filename).name}-${crypto.createHash('md5').update(str).digest('hex')}`;
}

interface HtmlEntry { type: string; src: string | null; origin: string }
function getEntryFromHtml(filename: string, type?: string): HtmlEntry | undefined {
  const html = fs.readFileSync(path.join(htmlTemplatesPath, filename), 'utf8');
  const $: CheerioAPI = cheerio.load(html);
  const entrySrc = $('script')
    .toArray()
    .map((node: Element) => $(node).attr('src') || '')
    .find(src => src.startsWith(`webpack${type ? `[${type}]` : ''}`));

  if (!entrySrc) return undefined;

  const typeMatch = entrySrc.match(/\[(\w+)\]/);
  const srcMatch = entrySrc.match(/\?([\w/.]+)/);

  return {
    type: typeMatch?.[1] || 'index',
    src: srcMatch?.[1] || null,
    origin: entrySrc,
  };
}

function findEntryMap(type?: string): Record<string, string> {
  const entrySet: Record<string, string> = {};
  fs.readdirSync(htmlTemplatesPath).forEach((filename: string) => {
    const entry = getEntryFromHtml(filename, type);

    if (entry && entry.src) {
      entrySet[getEntryName(entry.src, filename)] = entry.src;
    }
  });
  return entrySet;
}

module.exports = {
  // enum
  htmlTemplatesPath,
  // funcs
  wrapPathBase,
  webpackTaskFactory,
  parseNginxRewriteConf,
  getEntryName,
  getEntryFromHtml,
  findEntryMap,
};
