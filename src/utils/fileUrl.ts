import _ from 'lodash';

/**
 * 把「指向本部署文件服务的绝对地址」归一化成同源相对地址。
 *
 * 【为什么需要】同一套部署里不同服务报的文件地址不一致：
 *   主 API   /api/HomeApp/GetApp        -> "iconUrl":"/file/mdpub/customIcon/x.svg"（相对）
 *   工作流   /workflow_api/.../listAll  -> "iconUrl":"http://<裸IP>:8880/file/mdpub/customIcon/x.svg"
 * 后者在生产是【会被浏览器直接拦掉的混合内容】—— 页面是 https，地址是 http：
 *   Mixed Content: ... requested an insecure XMLHttpRequest endpoint 'http://...'.
 *   This request has been blocked; the content must be served over HTTPS.
 * 实测生产「应用 → 工作流」页：37 张图 33 张挂、10 个分组图标被拦，共 43 条报错。
 *
 * 【为什么不能只把 http 换成 https】实测那个裸 IP 走 https 是 Failed to fetch（证书对不上）。
 * 唯一可用的地址是同源：
 *   /file/mdpub/customIcon/sys_1_7_approval.svg  -> 200 image/svg+xml
 *   /file/mdpic/UserAvatar/default5.png?...      -> 200 image/png
 * 所以这里是【剥掉 origin】，不是改 scheme。
 *
 * 【为什么敢剥 —— 有前置条件，不是无脑剥】
 * 只有当这套部署自己声明「文件就在同源」时才剥，判据是 FileStoreConfig 里对应仓的配置值
 * 本身就是相对路径（本部署 pubHost = '/file/mdpub/'）。若哪天文件仓真的挂到独立 CDN，
 * 那边的 pubHost 会是绝对地址，这里就自动不动手，不会把 CDN 地址剥坏。
 *
 * 【只管展示用的三个仓，不含 mdoc】mdoc 的值前端【不是拿来发请求的，是拼好回传给后端的】
 * （KC 的 filePath、工作表的 serverName），改成相对会让后端收到非法地址、上传静默失败。
 * 这跟 CI/serve.ts 里 dev 代理的取舍是同一条理由，两边的仓名单也保持一致。
 *
 * 治本仍在服务端（工作流服务该和主 API 报同一个 host），这里是前端兜底。
 */
const BUCKET_CONFIG_KEY: Record<string, string> = {
  mdpub: 'pubHost',
  mdpic: 'pictureHost',
  mdmedia: 'mediaHost',
};

const ABSOLUTE_FILE_URL = /^https?:\/\/[^/]+(\/file\/(mdpub|mdpic|mdmedia)\/)/i;

/* 【判据不能只看"是不是相对路径"】第一版就是这么写的，结果发到生产完全不生效。
   原因：dev server 会把 FileStoreConfig 里的 /file/mdpub|mdpic|mdmedia 改写成【相对地址】
   （见 CI/serve.ts 的 REWRITE_PREFIXES），所以本地看到的是 pictureHost='/file/mdpic/'；
   而生产上它是【绝对地址】 pictureHost='https://oa.tlytelec.com:8880/file/mdpic'。
   拿本地观察到的形态当生产的前提条件，等于把 dev 代理的产物写进了产品逻辑。

   真正要判断的是「文件服务是不是就在当前页面这个 origin 上」，两种形态都算： */
function bucketServedFromSameOrigin(bucket: string) {
  const configured = _.get(window, ['md', 'global', 'FileStoreConfig', BUCKET_CONFIG_KEY[bucket]]);

  if (!_.isString(configured) || !configured) return false;

  // 形态一：相对地址（dev 下被改写成这样）—— 本身就意味着同源。
  if (configured.startsWith('/')) return true;

  // 形态二：绝对地址（生产的形态）—— origin 与当前页面一致才算同源。
  // 若哪天文件仓真挂到独立 CDN，这里 origin 对不上，自动不动手。
  try {
    return new URL(configured).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function normalizeFileUrl(url) {
  if (!_.isString(url) || !url) return url;

  const matched = url.match(ABSOLUTE_FILE_URL);

  if (!matched) return url;

  return bucketServedFromSameOrigin(matched[2].toLowerCase()) ? url.slice(url.indexOf(matched[1])) : url;
}

export default normalizeFileUrl;
