const http = require('http');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { networkInterfaces } = require('os');
const { URL } = require('url');
const { execSync } = require('child_process');

const handler = require('serve-handler');
const _ = require('lodash');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
// chalk 5+ 是纯 ESM。Node 22 起 require(esm) 已稳定（本仓 engines 要求 >=26.8.1），
// 所以 require 本身没问题，但拿到的是 ESM 命名空间对象，具名导出在 .default 上。
// 少写 .default 的表现是 `chalk.xxx is not a function`，不是 require 报错。
const chalk = require('chalk').default;

const utils = require('./utils');
const publishConfig = require('./publishConfig');
const generate = require('./generate');
const statusData = {};
const projectRootPath = path.join(__dirname, '..');
const iconViewerPath = path.join(projectRootPath, 'scripts/iconViewer');

function logObj(obj) {
  Object.keys(obj).forEach(key => console.log(`${chalk.yellow(key)}: ${chalk.green(obj[key])}`));
  console.log('\n');
}

function getLanIp() {
  return Object.values(networkInterfaces())
    .flat()
    .filter(details => details.family === 'IPv4' && !details.internal)
    .map(details => details.address);
}

function checkPort(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', err => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function getValuedPort(port = 30001) {
  const available = await checkPort(port);

  if (available) {
    return port;
  }

  return getValuedPort(port + 1);
}

// 【平台管理那份响应要用另一套前缀】/pm 那个控制台的配置是它【自己】的接口给的
// （platformapi 的 GetSysSettings 返回 accountApiUrl / accountWebUrl 等一串绝对地址），
// 不是主站的 GetGlobalMeta。这些前缀【不能】并进下面的 REWRITE_PREFIXES：
// 那一套作用在主站所有 /api/ 响应上，把 /account 加进去会一并改掉主站的
// Config.AccountUrl，动到登录链路。所以按代理条目分别指定。
// '/' 对应 hapWebUrl（控制台左上角「主页」按钮跳的地方），它的值整个就是 origin + '/'。
// rewriteAbsoluteHosts 对 '/' 有特殊处理（连引号一起匹配），见那里的注释。
// 它也是唯一不需要 proxyConfigs 条目的前缀 —— '/' 就是 dev server 自己的根，本地直接就有。
const PLATFORM_REWRITE_PREFIXES = ['/accountapi/', '/account/', '/platformapi/', '/pm/', '/'];

const proxyConfigs = [
  {
    name: 'md_agent_api',
    path: '/api/agent/',
    replace: '/api/agent/',
    server: publishConfig.apiServer,
  },
  {
    name: 'md_agui_api',
    path: '/api/agui/',
    replace: '/api/agui/',
    server: publishConfig.apiServer,
  },
  {
    name: 'md_artifacts_api',
    path: '/api/artifacts/',
    replace: '/api/artifacts/',
    server: publishConfig.apiServer,
  },
  // 【API_PATH_PREFIX：把 dev server 接到一套已部署的 HAP 上】
  // 上游默认 replace:'/'，前提是 API_SERVER 直接指向后端服务本身（服务在根路径提供接口）。
  // 但如果 API_SERVER 指向的是一套已部署 HAP 的 nginx 入口，布局完全不同：
  // 主 API 在 /wwwapi/，而 workflow / report / integration 等各挂在别的路径下，
  // 且【具体挂哪儿是每套部署自己定的】——见下面 resolveApiRoutes。
  //
  // 设了 API_PATH_PREFIX 就表示「按已部署 HAP 的方式接」，主 API 用它给出的前缀引导，
  // 其余服务在启动时自动推导。不设时行为与上游完全一致。
  //   API_SERVER=https://host:8880/  API_PATH_PREFIX=/wwwapi/
  //
  // 【为什么 rewriteHosts 开在通配的 api 上，而不是只开在某个接口上】
  // 这个开关会打开 selfHandleResponse，把响应整个缓冲下来，SSE / 流式接口会被憋住。
  // 但真正的流式接口（/api/agent/、/api/agui/、/api/artifacts/）都在上面单独列了，
  // handlers 按顺序取第一个匹配的，它们不会走到这条，所以这里开是安全的。
  // 剩下的 /api/ 都是普通 REST 响应，缓冲一下的代价在本地可以忽略。
  {
    name: 'api',
    path: '/api/',
    replace: process.env.API_PATH_PREFIX || '/',
    server: publishConfig.apiServer,
    rewriteHosts: true,
  },
  { name: 'workflow_api', path: '/workflow_api/', replace: '', server: publishConfig.apiServer },
  // 下面五条都是【原样透传】的静态/服务前缀，存在的意义是让 rewriteAbsoluteHosts
  // 改写出来的相对地址能落到本地 dev server 上，再由这里转发到真实部署。
  // 不加的话请求会被 serve-handler 兜底成 SPA 的 index.html，返回 200 但内容是 HTML——
  // 比 404 更难查：JS 报 `Unexpected token '<'`，图片/接口则是解析失败。
  //
  // file：FileStoreConfig 里的 upload/document/picture/media/pub 都在这个前缀下
  // chatmq：聊天服务（data.config.HTTP_SERVER）。只转发 HTTP，WebSocket 升级没接，
  //         所以本地的聊天列表能拉到，实时推送不通——本地环境不验聊天，够用。
  // pm：【平台管理】控制台，一个独立的部署产物（不在本仓路由里）。
  //     原本只是为了 freestyle.css / freestyle.js，后来 Config.PlatformUrl 也改写成
  //     相对地址（见 REWRITE_PREFIXES），整个控制台都从这条走。
  // platformapi：平台管理【自己的】后端（Config.PlatformApiUrl）。
  //     它不是本仓发的请求 —— 是 /pm 那个 SPA 按自身 origin 发的。
  //     PlatformUrl 改写成相对地址之前，控制台跑在生产 origin 上，这些请求
  //     自然落在生产；改写之后控制台跑在 localhost，就必须有这条转发。
  //     缺了它的表现极具迷惑性：POST /platformapi/SysSetting/GetSysSettings
  //     返回【200 + dev server 自己的 index.html】，控制台把 HTML 当 JSON 解析，
  //     页面只显示「初始化失败，请刷新页面后重试」，看不出和代理有任何关系。
  // excelapi：导出/打印服务（Config.WorksheetDownUrl → 各接口返回的 worksheetInfo.downLoadUrl）。
  //           工作表导出 Excel、导出 Word、打印模板全挂在它下面：
  //             ${downLoadUrl}/ExportExcel/Export       （ExportSheet.tsx、recordInfo/crtl.ts）
  //             ${downLoadUrl}/ExportWord/DownloadWord  （FormSet/components/EditPrint.tsx）
  //             ${downLoadUrl}/PrintTemplate/EditPrint  （UploadTemplateSheet/utils.ts）
  //           这条【不能开 rewriteHosts】：它返回的是文件流/下载响应，
  //           selfHandleResponse 会把整个文件缓冲进内存。
  { name: 'file', path: '/file/', replace: '/file/', server: publishConfig.apiServer },
  { name: 'chatmq', path: '/chatmq/', replace: '/chatmq/', server: publishConfig.apiServer },
  { name: 'pm', path: '/pm/', replace: '/pm/', server: publishConfig.apiServer },
  // platformapi 要开 rewriteHosts：它的 GetSysSettings 把 accountApiUrl 等
  // 一串【绝对地址】发给控制台，控制台照着发请求。不改写的话，控制台跑在
  // localhost 却往生产发 XHR，被 CORS 挡死，页面同样停在「初始化失败」——
  // 和缺代理条目时的症状一模一样，但成因完全不同。
  {
    name: 'platformapi',
    path: '/platformapi/',
    replace: '/platformapi/',
    server: publishConfig.apiServer,
    rewriteHosts: PLATFORM_REWRITE_PREFIXES,
  },
  // 平台管理要读当前账号信息；/account 是它跳转用的 web 地址
  { name: 'accountapi', path: '/accountapi/', replace: '/accountapi/', server: publishConfig.apiServer },
  { name: 'account', path: '/account/', replace: '/account/', server: publishConfig.apiServer },
  // 【平台管理里自定义的 favicon】CI/generate.js 生成的是写死的 href="/favicon.png"，
  // 生产上由 nginx 用 subs_filter 换成真正的地址（conf.d/subsfilter_hap_favicon）：
  //   subs_filter ('|")/favicon.png $1https://<host>/file/mdpic/ProjectLogo/favicon.png igr;
  // dev 的 index.html 是本地生成、不过代理的，没有这一步，所以只会显示默认图标。
  // 与其在 dev 侧复刻一遍 HTML 替换，不如让 /favicon.png 这个请求【自己】转发过去，
  // 效果等价：浏览器照旧请求 /favicon.png，拿到的是该部署自定义的那张。
  // 路径写死是照抄 nginx —— 那个文件由部署工具生成，只有 host 会变，
  // ProjectLogo/favicon.png 是固定约定。没配自定义图标时上游 404，
  // 浏览器退回无图标，与生产表现一致（nginx 那条替换也是无条件的）。
  {
    name: 'favicon',
    path: '/favicon.png',
    replace: '/file/mdpic/ProjectLogo/favicon.png',
    server: publishConfig.apiServer,
  },
  { name: 'excelapi', path: '/excelapi/', replace: '/excelapi/', server: publishConfig.apiServer },
  { name: 'report_api', path: '/report_api/', replace: '', server: publishConfig.apiServer },
  { name: 'integration_api', path: '/integration_api/', replace: '', server: publishConfig.apiServer },
  { name: 'data_pipeline_api', path: '/data_pipeline_api/', replace: '', server: publishConfig.apiServer },
  {
    name: 'workflow_plugin_api',
    path: '/workflow_plugin_api/',
    replace: '/workflowplugin/',
    server: publishConfig.apiServer,
  },
  {
    name: 'knowledge_api',
    path: '/knowledge_api/',
    replace: '',
    server: publishConfig.apiServer,
  },
  {
    name: 'cloudapi_api',
    path: '/cloudapi_api/',
    replace: '',
    server: publishConfig.apiServer,
  },
];

// 把接口响应里指向真实部署的【绝对地址】改写成相对地址，让请求落回本地 dev server。
//
// 起因：这些地址指向真实部署（如 https://host:8880/file/mdpub/...），而 dev server 跑在
// http://localhost:30001。走 <img> 的头像、附件不受影响（图片请求不校验同源），
// 但应用图标走的是 SvgIcon → react-svg → XMLHttpRequest，会被 CORS 挡死。
// 现象很迷惑：图标位置只剩一个纯色圆块，页面其余部分完全正常，像是前端渲染 bug。
//
// 【为什么必须对所有 /api/ 响应做，而不是只改 GetGlobalMeta】
// 一开始只改了 GetGlobalMeta 里的 FileStoreConfig，结果图标照样跨源。
// 原因是应用图标的地址【根本不是用 pubHost 拼的】：
//   item.iconUrl ? item.iconUrl : `${pubHost}/customIcon/${item.icon}.svg`
//（见 src/pages/worksheet/common/WorkSheetPortal/index.tsx）
// 只要接口给了 iconUrl 就直接用，而 HomeApp/MyPlatform、RecentApps 等接口
// 返回的 iconUrl 本身就是绝对地址。改配置项治不了这一类。
//
// 所以这里做的是【窄字符串替换】而不是解析 JSON 改字段：
// 只把「origin + 这几个已代理前缀」换成相对路径，其余一律不碰。
// 不解析 JSON 有两个好处：非 JSON 响应（图片、网关错误页）天然安全，
// 以及不用关心这些地址埋在响应的哪一层。
//
// 【为什么前缀要显式列出、不能直接剥 origin】
// config.SERVER_NAME 的值恰好【就等于 origin】，剥完是空串。它被直接喂给
// io.connect(server)（见 src/socket/index.ts），空串的语义是「连当前页面的 origin」，
// 跟「同源的某个路径」完全是两回事——本地没接 WebSocket 升级，改成空串只会
// 让它改为徒劳地重连 localhost。列出前缀就天然排除了这种纯 origin 的值。
// 尾斜杠按【配置值本身的形态】写，不要统一加：
// FileStoreConfig 给的是 .../file/xxx，而 Config.WorksheetDownUrl 给的是裸的
// `https://host:8880/excelapi`（无尾斜杠），调用点再自己拼 `/ExportExcel/Export`。
// 写成 '/excelapi/' 就匹配不上那个裸值，导出照旧发绝对地址、照旧被 CORS 挡死。
// '/chatmq' 同理；'/pm/' 则相反 —— Config.PlatformUrl 的值自带尾斜杠
//（`https://host:8880/pm/`），调用点直接拼 `hap/platform`、`legalportal/terms`。
//
// /pm 是【平台管理】控制台，一个独立的部署产物（不在本仓路由里：
// 本仓没有 hap/platform 这条路由，本地 /hap/platform 只会落到 SPA 兜底）。
// 不改写的话，dev 下点「平台管理」会直接 window.open 到生产地址。
// 它早就在 proxyConfigs 里（原本是为了 freestyle.css/js），代理实测可用：
// http://localhost:30001/pm/hap/platform 返回的内容与生产逐字节一致。
//
// 同类但【没有】一并处理的几个，都缺 proxyConfigs 条目，加改写只会让它们
// 从"跳生产"变成"拿到 SPA 的 index.html"（200 + HTML，更难查）：
//   Config.HDPUrl (/hdp)         —— 该服务在本部署压根没起，生产端直接 502
//   Config.OpenApiDocUrl (/apidoc/) —— 只用于 href / iframe 看文档，跳生产无害
//   Config.AccountUrl (/account/)   —— 登录链路，动它风险大
const REWRITE_PREFIXES = ['/file/', '/chatmq', '/excelapi', '/pm/'];

function rewriteAbsoluteHosts(buffer, server, prefixes = REWRITE_PREFIXES) {
  let origin;

  try {
    origin = new URL(server).origin;
  } catch {
    // 上游默认值是 '/wwwapi/' 这种相对路径，不是合法 URL —— 此时无事可做
    return buffer;
  }

  const text = buffer.toString('utf8');

  if (!text.includes(origin)) return buffer;

  let out = text;

  for (const prefix of prefixes) {
    // '/' 是特例：它对应的值（如平台管理配置里的 hapWebUrl）【整个就等于 origin + '/'】。
    // 按普通前缀处理会把 origin + '/wwwapi/'、origin + '/apidoc/' 这些也一并改成
    // 相对地址，而它们在 dev 侧都【没有】转发条目，换来的只是 SPA 兜底（200 + HTML）。
    // 所以把左右引号一起纳入匹配，只替换「整个值就是 origin + '/'」的那一类。
    if (prefix === '/') {
      out = out.split(`"${origin}/"`).join('"/"');
      continue;
    }

    out = out.split(origin + prefix).join(prefix);
  }

  return out === text ? buffer : out;
}

// 把 proxy-middleware 替换为 http-proxy-middleware：
// - 内置 SSE / WebSocket 支持，上游断开不再串到下个中间件触发 ERR_HTTP_HEADERS_SENT
// - 错误统一在 on.error 里兜底，不会让 dev server 进程崩溃
// rewriteHosts: true 用默认的 REWRITE_PREFIXES；传数组则用这一条自己的前缀表
// （见 PLATFORM_REWRITE_PREFIXES —— 平台管理那份响应里的地址和主站不是一套）。
function makeProxy({ name, server, path: matchPath, replace, rewriteHosts: rewrite }) {
  const prefixes = Array.isArray(rewrite) ? rewrite : REWRITE_PREFIXES;

  return createProxyMiddleware({
    target: server,
    changeOrigin: true,
    // path 与 replace 相同（如 /api/agent/）的配置等价于 no-op，仍交给 pathRewrite 走一遍统一逻辑
    pathRewrite: { [`^${matchPath}`]: replace },
    logger: { info: () => {}, warn: console.warn, error: console.error },
    ...(rewrite ? { selfHandleResponse: true } : null),
    on: {
      ...(rewrite
        ? { proxyRes: responseInterceptor(async buffer => rewriteAbsoluteHosts(buffer, server, prefixes)) }
        : null),
      error(err, req, res) {
        console.error(`[proxy ${name}] ${req.url} -> ${server} failed:`, err.message);
        if (!res || res.headersSent) {
          if (res && typeof res.destroy === 'function') res.destroy(err);
          return;
        }

        try {
          res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Bad gateway');
        } catch {
          /* ignore */
        }
      },
    },
  });
}

// 每个 dev 侧前缀对应 GetGlobalMeta 里的哪个 Config 字段。
// 这组配对不是猜的，来自 src 里统一的取址写法：`__api_server__.<key> || md.global.Config.<Key>`
//（见 src/pages/workflow/apiV2/base.ts 等）。dev 下走前者，生产下走后者，
// 所以「后者的路径」就是「前者该被重写成什么」。
const API_ROUTE_CONFIG_KEYS = {
  workflow_api: 'WorkFlowUrl',
  report_api: 'WsReportUrl',
  integration_api: 'IntegrationAPIUrl',
  data_pipeline_api: 'DataPipelineUrl',
  workflow_plugin_api: 'WorkflowPluginUrl',
  knowledge_api: 'KnowledgeApiUrl',
  cloudapi_api: 'CloudApiUrl',
};

// 【为什么要自动推导，不能写死】各服务挂在哪个路径下是每套部署自己定的，
// 同一个 workflow 服务，这套部署在 /api/workflow，另一套可能在别处。写死就只对一套有效。
// 好在部署会通过 GetGlobalMeta 把自己的 Config 全报出来，启动时问一次即可。
//
// 不推导的后果很隐蔽：页面能登录、能看数据，只有待办数这类少数模块 404，
// 而且返回的是 SPA 的 index.html（200 + text/html，不是 404），
// 前端把它当接口响应去解析，报出来的是「404 页面不存在」，看着完全像前端 bug。
async function resolveApiRoutes(mainPrefix) {
  const base = publishConfig.apiServer;
  let metaUrl;

  try {
    metaUrl = new URL(mainPrefix.replace(/^\//, '') + 'Global/GetGlobalMeta', base);
  } catch {
    console.warn(chalk.yellow(`[proxy] API_SERVER=${base} 不是合法 URL，跳过服务前缀推导`));
    return;
  }

  let config;

  try {
    const res = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20000),
    });

    config = _.get(await res.json(), ['data', 'md.global', 'Config']);
  } catch (err) {
    console.warn(chalk.yellow(`[proxy] 读取 ${metaUrl} 失败，各服务前缀沿用默认值：${err.message}`));
    return;
  }

  if (!config) {
    console.warn(chalk.yellow(`[proxy] ${metaUrl} 的响应里没有 md.global.Config，各服务前缀沿用默认值`));
    return;
  }

  const resolved = {};

  for (const proxyConfig of proxyConfigs) {
    const value = config[API_ROUTE_CONFIG_KEYS[proxyConfig.name]];

    if (typeof value !== 'string' || !value) continue;

    let url;

    try {
      url = new URL(value);
    } catch {
      continue;
    }

    // 前缀必须带结尾斜杠：pathRewrite 替换掉的 `^/workflow_api/` 是带斜杠的，
    // 不补的话 /workflow_api/v1/x 会拼成 /api/workflowv1/x。
    proxyConfig.replace = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    // 个别服务可能部署在别的 origin 上，那样只改路径不够，target 也要跟着换。
    proxyConfig.server = url.origin;
    resolved[proxyConfig.name] = `${proxyConfig.server}${proxyConfig.replace}`;
  }

  logObj({ ...resolved, api: `${publishConfig.apiServer}${mainPrefix.replace(/^\//, '')}` });
}

const proxyMiddlewares = {};

function buildProxyMiddlewares() {
  for (const config of proxyConfigs) {
    proxyMiddlewares[config.name] = makeProxy(config);
  }
}

function createRequestHandlers() {
  const rewrites = utils
    .parseNginxRewriteConf([
      path.join(__dirname, '../docker/rewrite.setting'),
      path.join(__dirname, '../docker/portal.rewrite.setting'),
    ])
    .concat({
      match: '^/demo',
      redirect: '/index.html',
      ignoreCase: true,
    });

  const handlers = [
    // root redirect
    {
      match: req => req.url === '/',
      handle: (req, res) => {
        res.writeHead(301, { Location: '/dashboard' });
        res.end();
      },
    },
    // generic proxy：/__proxy?url=<encoded-target-url>
    {
      match: req => req.url.startsWith('/__proxy'),
      handle: (req, res, next) => {
        const urlObj = new URL(req.url, 'https://md.md');
        const proxyUrl = decodeURIComponent(urlObj.searchParams.get('url'));
        const proxyUrlObj = new URL(proxyUrl);

        req.url = proxyUrl.replace(proxyUrlObj.origin, '');
        createProxyMiddleware({
          target: proxyUrlObj.origin,
          changeOrigin: true,
          logger: { info: () => {}, warn: console.warn, error: console.error },
          on: {
            error(err) {
              console.error(`[proxy __proxy] ${proxyUrlObj.origin} failed:`, err.message);
              if (!res.headersSent) {
                try {
                  res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
                  res.end('Bad gateway');
                } catch {
                  /* ignore */
                }
              }
            },
          },
        })(req, res, next);
      },
    },
    // api proxies：pathRewrite 已在 makeProxy 里配置，调用点无需手动 replace url
    ...proxyConfigs.map(config => ({
      match: req => req.url.startsWith(config.path),
      handle: (req, res, next) => proxyMiddlewares[config.name](req, res, next),
    })),
    // static files
    {
      match: req => req.url.startsWith('/dist/'),
      handle: (req, res, next) => next(),
    },
    // local helper files, for example /__fonticon
    {
      match: req => req.url.startsWith('/__'),
      handle: (req, res) => {
        const url = new URL(`http://md.md${req.url}`);
        const basePath = url.pathname[3] === '/' ? projectRootPath : iconViewerPath;
        const filePath = path.join(basePath, url.pathname.slice(3) + (/\./.test(url.pathname) ? '' : '.html'));
        const rs = fs.createReadStream(filePath);
        rs.on('error', () => {
          console.log(`can not find ${url.pathname} ${filePath}`);
          res.statusCode = 404;
          res.end('404');
        });
        rs.pipe(res);
      },
    },
    // get git branch
    {
      match: req => req.url === '/_branch',
      handle: (req, res) => {
        res.end(execSync('git branch | grep ^\\*').toString().trim());
      },
    },
    // nginx rewrites
    {
      match: req =>
        _.findIndex(rewrites, rule => new RegExp(rule.match, rule.ignoreCase ? 'i' : '').test(req.url)) > -1,
      handle: (req, res, next) => {
        const matchedIndex = _.findIndex(rewrites, rule =>
          new RegExp(rule.match, rule.ignoreCase ? 'i' : '').test(req.url),
        );
        const { match, redirect, ignoreCase } = rewrites[matchedIndex];
        req.url = redirect.includes('$')
          ? req.url.replace(new RegExp(match, ignoreCase ? 'ig' : 'g'), redirect)
          : redirect;
        req.url = `/files${req.url}`;
        next();
      },
    },
  ];

  return function (req, res, next) {
    for (const handler of handlers) {
      if (handler.match(req)) {
        return handler.handle(req, res, next);
      }
    }

    // Fallback to 404
    res.statusCode = 404;
    res.end('404');
  };
}

async function regenerateDevHtmlIfMissing({ filePath, pathname, isProductionServer }) {
  if (
    isProductionServer ||
    process.env.NODE_ENV === 'production' ||
    !pathname.startsWith('/files/') ||
    !/\.html?$/.test(pathname) ||
    fs.existsSync(filePath)
  ) {
    return;
  }

  try {
    console.log(`missing ${pathname}, regenerating build/files html`);
    await generate();
  } catch (err) {
    console.error('regenerate build/files html failed:', err);
  }
}

const middlewareList = [
  createRequestHandlers(),
  function (req, res, next) {
    // 控制页面 TODO
    if (req.url === '/--dashboard') {
      res.end(`dashboard-${statusData.localUrl}`);
    } else {
      next();
    }
  },
  function (req, res, next) {
    // 跨域处理 + 禁止缓存。headers 已发出（代理流式中断回流到此）时 setHeader 会抛
    // ERR_HTTP_HEADERS_SENT 直接崩进程，加 guard 兜底
    if (!res.headersSent) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public,max-age=0');
    }

    next();
  },
];

function runMiddleware(req, res, callback) {
  const stack = middlewareList.slice();

  (function next() {
    if (stack.length > 0) {
      const fn = stack.shift();
      fn(req, res, next);
    } else {
      callback();
    }
  })();
}

async function serve({ done = () => {}, needOpen = true, isProduction: isProductionServer = false } = {}) {
  // 必须在 createServer 之前完成：推导会改写 proxyConfigs 里的 replace/server，
  // 而 makeProxy 是按当时的值固化进中间件的，先建中间件再推导就白推了。
  if (process.env.API_PATH_PREFIX) {
    await resolveApiRoutes(process.env.API_PATH_PREFIX);
  }

  buildProxyMiddlewares();

  const port = await getValuedPort();
  const server = http.createServer((req, res) => {
    runMiddleware(req, res, async () => {
      // 静态文件服务实现
      const { pathname } = new URL(`http://md.md${req.url}`);

      if (/\.html?$/.test(pathname)) {
        // 添加本地样式
        try {
          const filePath = path.join(__dirname, '../build', pathname);
          await regenerateDevHtmlIfMissing({ filePath, pathname, isProductionServer });
          let text = fs.readFileSync(filePath).toString();
          text = text.replace(
            /<script src="\/dist\/pack\/common\.dev\.js"><\/script>/i,
            '<script src="/dist/pack/common.dev.js"></script><script src="/dist/pack/css.dev.js"></script>',
          );
          res.end(text);
        } catch {
          console.log(`can not find ${pathname}`, path.join(__dirname, '../build', pathname));
          res.statusCode = 404;
          res.end('404');
        }
      } else {
        handler(req, res, {
          headers:
            req.headers.referer && new URL(req.headers.referer).pathname.endsWith('freefield')
              ? [
                  {
                    source: '**',
                    headers: [
                      {
                        key: 'cache-control',
                        value: 'public,max-age=86400',
                      },
                    ],
                  },
                ]
              : [],
          public: path.join(__dirname, '../build'),
        });
      }
    });
  });

  server.on('error', err => {
    console.log('\nstart failed ! 💣💀💣', err);
  });

  server.listen(port, () => {
    const lanIps = getLanIp();
    const localUrl = `http://localhost:${port}`;
    statusData.localUrl = localUrl;
    console.log('\n启动成功! 🎉 🎉 🎉\n');
    logObj({
      地址: localUrl,
      局域网地址: lanIps.length ? `http://${lanIps[0]}:${port}` : 'N/A',
      'api 服务器': publishConfig.apiServer,
    });
    if (needOpen) {
      // open v9+ 是纯 ESM：CJS 里 require() 拿到的是命名空间对象而非函数，
      // 必须走动态 import 取 default。顺手补 catch，否则 spawn 失败会变成
      // unhandledRejection 把 dev server 崩掉。
      import('open')
        .then(({ default: open }) => open(`${localUrl}/dashboard`))
        .catch(err => console.error('open browser failed:', err.message));
    }

    done();
  });
}

module.exports = serve;
