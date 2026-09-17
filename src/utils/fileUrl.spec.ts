/**
 * 文件地址归一化的行为约定。
 *
 * 【背景】生产「应用 → 工作流」页实测 43 条 Mixed Content 报错、37 张图挂 33 张：
 * 工作流服务返回的 iconUrl / avatar 是 http + 裸 IP 的绝对地址，而页面是 https，
 * 浏览器直接拦掉（"This request has been blocked"）。主 API 返回的同一个图标却是
 * 相对路径 —— 同一套部署两个服务不一致。治本在服务端，这里是前端兜底。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../../scripts/spec-harness.ts');

/* ---------- 1. 纯函数行为 ---------- */

// 这个模块只依赖 window.md.global.FileStoreConfig，直接造一个再 require。
global.window = global.window || {};
(global.window as any).location = { origin: 'https://oa.example.com:8880' };

/* 【必须按生产的形态来测】FileStoreConfig 在 dev 下是【相对地址】，因为 CI/serve.ts 会改写它；
   生产上是【绝对地址】。第一版实现只认相对形态，本地怎么测都过，发到生产完全不生效
   —— 就是拿 dev 代理的产物当了生产的前提条件。所以这里主用例照抄生产形态。 */
(global.window as any).md = {
  global: {
    FileStoreConfig: {
      pubHost: 'https://oa.example.com:8880/file/mdpub',
      pictureHost: 'https://oa.example.com:8880/file/mdpic',
      mediaHost: 'https://oa.example.com:8880/file/mdmedia',
      documentHost: 'https://oa.example.com:8880/file/mdoc',
    },
  },
};

const { normalizeFileUrl } = require(path.join(ROOT, 'src/utils/fileUrl.ts'));

assert.strictEqual(
  normalizeFileUrl('http://220.179.193.129:8880/file/mdpub/customIcon/sys_1_7_approval.svg'),
  '/file/mdpub/customIcon/sys_1_7_approval.svg',
  '指向本部署的绝对图标地址要剥成同源相对地址 —— 这正是生产被拦掉的那一类。',
);

assert.strictEqual(
  normalizeFileUrl('http://220.179.193.129:8880/file/mdpic/UserAvatar/default5.png?watermark/2/text/RXM='),
  '/file/mdpic/UserAvatar/default5.png?watermark/2/text/RXM=',
  '头像同理，且查询串要原样保留（水印参数就在查询串里）。',
);

assert.strictEqual(
  normalizeFileUrl('/file/mdpub/customIcon/x.svg'),
  '/file/mdpub/customIcon/x.svg',
  '本来就是相对地址的不要动。',
);

assert.strictEqual(
  normalizeFileUrl('https://oa.example.com:8880/file/mdoc/abc.docx'),
  'https://oa.example.com:8880/file/mdoc/abc.docx',
  'mdoc 绝对不能剥：这个值前端不是拿来发请求的，是拼好回传给后端的' +
    '（KC 的 filePath、工作表的 serverName），剥了会让上传静默失败。',
);

assert.strictEqual(
  normalizeFileUrl('https://cdn.thirdparty.com/assets/logo.svg'),
  'https://cdn.thirdparty.com/assets/logo.svg',
  '不带 /file/<仓>/ 的外部地址一律不碰。',
);

[undefined, null, '', 0].forEach(v => {
  assert.strictEqual(normalizeFileUrl(v), v, `非字符串/空值要原样返回（${String(v)}）`);
});

/* ---------- 2. dev 的相对形态也要认 ---------- */

(global.window as any).md.global.FileStoreConfig.pubHost = '/file/mdpub/';

assert.strictEqual(
  normalizeFileUrl('http://220.179.193.129:8880/file/mdpub/customIcon/x.svg'),
  '/file/mdpub/customIcon/x.svg',
  'dev 下 CI/serve.ts 会把 pubHost 改写成相对地址，这种形态同样意味着同源，要照剥。',
);

/* ---------- 3. 前置条件：文件仓真在别的 origin 时，不许剥 ---------- */

(global.window as any).md.global.FileStoreConfig.pubHost = 'https://cdn.somewhere.com/file/mdpub/';

assert.strictEqual(
  normalizeFileUrl('https://cdn.somewhere.com/file/mdpub/customIcon/x.svg'),
  'https://cdn.somewhere.com/file/mdpub/customIcon/x.svg',
  '若 pubHost 的 origin 与当前页面不一致（文件仓挂在独立 CDN），说明文件【不在同源】，' +
    '剥掉 origin 会把好地址改坏。注意判据是 origin 比对，不是「是不是相对路径」—— ' +
    '生产的 FileStoreConfig 本来就是绝对地址，只看相对会导致线上完全不生效。',
);

(global.window as any).md.global.FileStoreConfig.pubHost = 'https://oa.example.com:8880/file/mdpub';

/* ---------- 3. 两个调用点不能被悄悄摘掉 ---------- */

const svgIcon = fs.readFileSync(path.join(ROOT, 'src/ming-ui/components/SvgIcon.tsx'), 'utf8');
const avatar = fs.readFileSync(path.join(ROOT, 'src/ming-ui/components/Avatar.tsx'), 'utf8');

assert.ok(
  /src=\{normalizeFileUrl\(url\)\}/.test(svgIcon),
  'SvgIcon 必须归一化 url：图标是走 XHR 取回来内联的，跨源/混合内容会被直接拦死，' +
    '表现是图标位置空着而页面其余部分完全正常。',
);

assert.ok(
  /normalizeFileUrl\(src\)/.test(avatar),
  'Avatar 必须归一化 src：http 图片在 https 页面上属于会被拦的混合内容。',
);
