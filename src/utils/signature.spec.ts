/**
 * 签名 URL 归一化的行为约定。
 *
 * 【背景】安卓 App 签名上传的**字节是 PNG**（alpha 完好），但存储 key 的后缀被写成
 * .JPEG。服务端导出 Excel 打印件时【按扩展名】决定转码格式，于是被转成真 JPEG、
 * 丢掉 alpha，签名在纸面上变成白色方块。存量数据已单独修过；这里守的是
 * 前端自己别把坏 URL 再传播出去。
 *
 * 【这个 spec 只测纯函数】ensurePngSignatureUrl 要发网络请求，本仓没有 mock 设施，
 * 测不了。但它的两处判断（扩展名、PNG 魔数）和一处改写（去读时签名）都是纯的，
 * 抽出来单独守住 —— 写错了不会报错，只会在几个月后的打印件上显形。
 */
const assert = require('assert');
const path = require('path');
const { ROOT } = require('../../scripts/spec-harness.ts');

const { isPngBytes, isPngUrl, stripFileUrlSignature } = require(path.join(ROOT, 'src/utils/signature.ts'));

/* ---------- 1. 去读时签名 ---------- */

// 生产实测的真实形态（2026-09-19 在 oa 上调 Qiniu/GetUploadToken 拿到的）：
// getToken 回包的 url 带 ?e=…&token=…，而库里存的是裸 URL，签名是读的时候现补的。
assert.strictEqual(
  stripFileUrlSignature(
    'https://oa.example.com:8880/file/mdpic/Sign/app/sheet/20260919/abc.png?e=1789812861&token=mdstorage:r3KPHL7=',
  ),
  'https://oa.example.com:8880/file/mdpic/Sign/app/sheet/20260919/abc.png',
  '带读时签名的 url 必须剥成裸 URL —— 存进字段的签名一过期，图就打不开。',
);

assert.strictEqual(
  stripFileUrlSignature('https://oa.example.com:8880/file/mdpic/pic/20260919/abc.png'),
  'https://oa.example.com:8880/file/mdpic/pic/20260919/abc.png',
  '本来就没有查询串的，原样返回。',
);

for (const empty of ['', null, undefined]) {
  assert.strictEqual(stripFileUrlSignature(empty as any), empty, '空值原样返回，不要抛。');
}

/* ---------- 2. 扩展名判定 ---------- */

assert.ok(isPngUrl('https://x/a.png'), '.png 命中');
assert.ok(isPngUrl('https://x/a.PNG'), '【大小写不敏感】安卓存的是大写 .JPEG，同族的 .PNG 也得认。');
assert.ok(isPngUrl('https://x/a.png?e=1&token=y'), '带读时签名时，扩展名在 ? 前面，照样要认出来。');

assert.ok(!isPngUrl('https://x/a.JPEG'), '.JPEG 就是要修的那一类');
assert.ok(!isPngUrl('https://x/a.jpg?e=1'), '.jpg 同理');
assert.ok(!isPngUrl('https://x/png/a.jpg'), '【路径里出现 png 不算】只看扩展名，不能拿 indexOf 糊弄。');
assert.ok(!isPngUrl(''), '空串不算');

/* ---------- 3. PNG 魔数 ---------- */

assert.ok(isPngBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), 'PNG 头 89 50 4E 47');

// 【这条是整件事的关键】安卓传上来的就是这个：名字叫 .JPEG，字节是 PNG。
// 只有认出它是 PNG，才敢「只换名字重传、不转码」。
assert.ok(isPngBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), '刚好 4 字节也要能判');

assert.ok(!isPngBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'JPEG 头 FF D8 —— 真 JPEG 不能动，alpha 早没了');
assert.ok(!isPngBytes(new Uint8Array([0x89, 0x50])), '不足 4 字节不能判成 PNG（别越界读 undefined）');
assert.ok(!isPngBytes(new Uint8Array([])), '空数组');

console.log('signature.spec: 通过');
