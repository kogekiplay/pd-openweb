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
(global.window as any).md = {
  global: {
    FileStoreConfig: {
      pubHost: '/file/mdpub/',
      pictureHost: '/file/mdpic/',
      mediaHost: '/file/mdmedia/',
      // 注意：mdoc 生产是绝对地址，这里照抄真实形态
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

/* ---------- 2. 前置条件：部署声明文件不在同源时，不许剥 ---------- */

(global.window as any).md.global.FileStoreConfig.pubHost = 'https://cdn.somewhere.com/file/mdpub/';
delete require.cache[require.resolve(path.join(ROOT, 'src/utils/fileUrl.ts'))];
const reloaded = require(path.join(ROOT, 'src/utils/fileUrl.ts'));

assert.strictEqual(
  reloaded.normalizeFileUrl('https://cdn.somewhere.com/file/mdpub/customIcon/x.svg'),
  'https://cdn.somewhere.com/file/mdpub/customIcon/x.svg',
  '若这套部署的 pubHost 本身是绝对地址（文件仓挂在独立 CDN），说明文件【不在同源】，' +
    '此时剥掉 origin 会把好地址改坏。判据就是 FileStoreConfig 里对应仓的配置值形态。',
);

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
