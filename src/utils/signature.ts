/**
 * 签名控件（type 42）相关的 URL 归一化。
 *
 * 【为什么扩展名这么要命】服务端导出 Excel 打印件时**按扩展名**决定转码格式。
 * 后缀是 .jpeg/.jpg 就会被转成真 JPEG，alpha 丢掉，签名在纸面上变成白色方块。
 * 安卓 App 存进来的 key 后缀是 .JPEG，但**字节本身是 PNG**（alpha 完好）——
 * 所以这里只做「换个正确的名字重传」，不做任何转码。
 *
 * 【不要在前端转码】canvas 重绘 / toDataURL 二次编码都只会掉质量，
 * 而且救不了 App 那条路。转码逻辑在服务端的下载服务里，前端改不动。
 *
 * 【为什么 axios 和 getToken 是函数里动态 import 的】本模块的纯函数部分
 * （isPngBytes / isPngUrl / stripFileUrlSignature）要能被本仓的 node spec
 * 直接 require 到。顶层 import './common' 会把那个被 788 个文件引用的大块头
 * 连同它的一整串依赖拖进 node，spec 根本载不起来。
 * 放进异步函数体里，载模块时不执行，测纯函数就不受影响。
 */

/** PNG 的魔数：89 50 4E 47。 */
export function isPngBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

/** URL 的扩展名是不是 .png（忽略大小写，忽略后面的查询串）。 */
export function isPngUrl(url: string): boolean {
  return /\.png(\?|$)/i.test(url || '');
}

/**
 * 去掉文件 URL 上的**读时签名**（`?e=…&token=…`）。
 *
 * 【为什么必须去】getToken 回包里的 url 是带签名的，形如
 *   https://…/file/mdpic/Sign/<appId>/<worksheetId>/<日期>/xxx.png?e=1789812861&token=mdstorage:…
 * 而库里存的是**裸 URL**，签名是服务端读的时候现补的 ——
 * 判据：同一批文件不管哪天传的，读回来的 e= 完全相同。
 * 把带签名的串存进字段，签名一过期图就打不开。
 */
export function stripFileUrlSignature(url: string): string {
  if (!url || typeof url !== 'string') return url;

  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}

/** Uint8Array -> base64。分块是必须的：签名图能到几百 KB，一次性展开会爆栈。 */
function base64OfBytes(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }

  return btoa(binary);
}

interface SignatureTokenArgs {
  projectId?: string;
  appId?: string;
  worksheetId?: string;
}

/**
 * 保证签名 URL 以 .png 结尾。已经是 .png 就原样返回（不产生任何请求）。
 *
 * 不是 .png 时：把图取回来，确认字节确实是 PNG，再以 .png 重传一份，返回新的裸 URL。
 * **字节不是 PNG 就不动** —— 那是真 JPEG，透明度早没了，重传也救不回来，
 * 白白多一份文件。
 *
 * 任何一步失败都返回原 URL：这条链路是「顺手修好」，不是「修不好就别想签名」。
 */
export async function ensurePngSignatureUrl(url: string, tokenArgs: SignatureTokenArgs = {}): Promise<string> {
  if (!url || isPngUrl(url)) return url;

  try {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());

    if (!isPngBytes(bytes)) return url;

    const [{ getToken }, { default: axios }] = await Promise.all([import('./common'), import('axios')]);
    const res = await getToken([{ bucket: 4, ext: '.png' }], 10, tokenArgs);

    if (!res || res.error || !res[0]) return url;

    await axios.post(
      `${md.global.FileStoreConfig.uploadHost}/putb64/-1/key/${btoa(res[0].key)}`,
      base64OfBytes(bytes),
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: `UpToken ${res[0].uptoken}`,
        },
      },
    );

    return stripFileUrlSignature(res[0].url);
  } catch (err) {
    console.error('签名扩展名归一化失败，沿用原 URL', err);
    return url;
  }
}
