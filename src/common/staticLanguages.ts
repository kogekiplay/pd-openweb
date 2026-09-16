/**
 * 登录页等【SPA 之前】的引导脚本：按语言替换页面里的占位文本。
 *
 * 【为什么它不是普通模块】这段代码由 6 个静态页用 <script src> 直接加载
 *（CI/generate.ts 与 staticfiles/html/*.html），跑在主包之前；
 * 那些页面的 <body> 初始是 display:none，靠它最后一行放出来。
 * 所以【交付物必须是 /staticfiles/staticLanguages.js】—— 改后缀浏览器就不认了。
 *
 * 【那为什么源码放在这里】原先仓里直接躺着那份 .js：432 行我们自己写的代码，
 * 六道门禁一道都看不到它（staticfiles/ 整个目录在 JS 白名单里）。
 * 现在源码是这份 .ts，受类型检查；交付的 .js 由 scripts/build.ts 的
 * copyStatic() 用 esbuild 生成，不入库。做法与 vditor 的运行期资源一致。
 *
 * 【类型收紧的收益】LangMap 要求四种语言【一个都不能少】。
 * 原来漏一个语言不会有任何提示，运行时静默回落到英文。
 */

/** 与 i18n_langtag cookie 的取值一致 */
type LangTag = 'en' | 'ja' | 'zh-Hans' | 'zh-Hant';

/** 一条文案的四种语言。【刻意不用 Partial】漏翻译要在编译期就报出来。 */
type LangMap = Record<LangTag, string>;

/**
 * 键是页面里写的中文原文，值是各语言译文。
 * 页面里的写法：<transformLang>登录</transformLang>，或 <title>登录</title>。
 */
const staticLanguages: Record<string, LangMap> = {
  登录: {
    en: 'Login',
    ja: 'ログイン',
    'zh-Hans': '登录',
    'zh-Hant': '登入',
  },
  助手: {
    en: 'Assistant',
    ja: 'アシスタント',
    'zh-Hans': '助手',
    'zh-Hant': '助手',
  },
  企业微信工具栏: {
    en: 'Enterprise WeChat Toolbar',
    ja: '企業WeChatツールバー',
    'zh-Hans': '企业微信工具栏',
    'zh-Hant': '企業微信工具欄',
  },
  日程分享: {
    en: 'Schedule Sharing',
    ja: 'スケジュール共有',
    'zh-Hans': '日程分享',
    'zh-Hant': '日程分享',
  },
  注销: {
    en: 'Logout',
    ja: 'ログアウト',
    'zh-Hans': '注销',
    'zh-Hant': '註銷',
  },
  登录成功: {
    en: 'Login Successful',
    ja: 'ログイン成功',
    'zh-Hans': '登录成功',
    'zh-Hant': '登入成功',
  },
  了解更多: {
    en: 'Learn More',
    ja: 'もっと詳しく',
    'zh-Hans': '了解更多',
    'zh-Hant': '了解更多',
  },
  帮助中心: {
    en: 'Help Center',
    ja: 'ヘルプセンター',
    'zh-Hans': '帮助中心',
    'zh-Hant': '幫助中心',
  },
  您可以关闭此窗口了: {
    en: 'You Can Close This Window Now',
    ja: 'このウィンドウを閉じることができます',
    'zh-Hans': '您可以关闭此窗口了',
    'zh-Hant': '您可以關閉此窗口了',
  },
  自定义页面: {
    en: 'Custom Page',
    ja: 'カスタムページ',
    'zh-Hans': '自定义页面',
    'zh-Hant': '自定義頁面',
  },
  自定义分享: {
    en: 'Custom Sharing',
    ja: 'カスタム共有',
    'zh-Hans': '自定义分享',
    'zh-Hant': '自定義分享',
  },
  邮箱验证: {
    en: 'Email Verification',
    ja: 'メール確認',
    'zh-Hans': '邮箱验证',
    'zh-Hant': '郵箱驗證',
  },
  excel下载: {
    en: 'Excel Download',
    ja: 'Excelダウンロード',
    'zh-Hans': 'excel下载',
    'zh-Hant': 'excel下載',
  },
  加载中: {
    en: 'Loading',
    ja: '読み込み中',
    'zh-Hans': '加载中',
    'zh-Hant': '加載中',
  },
  知识分享: {
    en: 'Knowledge Sharing',
    ja: '知識共有',
    'zh-Hans': '知识分享',
    'zh-Hant': '知識分享',
  },
  登出: {
    en: 'Logout',
    ja: 'ログアウト',
    'zh-Hans': '登出',
    'zh-Hant': '登出',
  },
  // 【这条原先定义了两次】迁成 .ts 时 esbuild 才报出来（原来那份 .js 在 JS 白名单里，
  // 没有任何工具看过它）。两处只差日语：前一处是 '統計図'，这一处是 '統計チャート'。
  // 对象字面量里后者覆盖前者，所以线上一直生效的是这一条 —— 保留它、删掉前一条，
  // 行为不变。
  统计图: {
    en: 'Statistics Chart',
    ja: '統計チャート',
    'zh-Hans': '统计图',
    'zh-Hant': '統計圖',
  },
  流程图: {
    en: 'Flow Chart',
    ja: 'フローチャート',
    'zh-Hans': '流程图',
    'zh-Hant': '流程圖',
  },
  甘特图: {
    en: 'Gantt Chart',
    ja: 'ガントチャート',
    'zh-Hans': '甘特图',
    'zh-Hant': '甘特圖',
  },
  日志: {
    en: 'Log',
    ja: 'ログ',
    'zh-Hans': '日志',
    'zh-Hant': '日誌',
  },
  自定义插件: {
    en: 'Custom Plugin',
    ja: 'カスタムプラグイン',
    'zh-Hans': '自定义插件',
    'zh-Hant': '自定義插件',
  },
  支付: {
    en: 'Payment',
    ja: '支払い',
    'zh-Hans': '支付',
    'zh-Hant': '支付',
  },
  支付失败: {
    en: 'Payment Failed',
    ja: '支払い失敗',
    'zh-Hans': '支付失败',
    'zh-Hant': '支付失敗',
  },
  支付成功: {
    en: 'Payment Successful',
    ja: '支払い成功',
    'zh-Hans': '支付成功',
    'zh-Hant': '支付成功',
  },
  外部门户登录: {
    en: 'External Portal Login',
    ja: '外部ポータルログイン',
    'zh-Hans': '外部门户登录',
    'zh-Hant': '外部門戶登入',
  },
  外部门户找回密码: {
    en: 'External Portal Password Recovery',
    ja: '外部ポータルパスワード回復',
    'zh-Hans': '外部门户找回密码',
    'zh-Hant': '外部門戶找回密碼',
  },
  外部门户协议: {
    en: 'External Portal Agreement',
    ja: '外部ポータル協議',
    'zh-Hans': '外部门户协议',
    'zh-Hant': '外部門戶協議',
  },
  公开查询: {
    en: 'Public Query',
    ja: '公開クエリ',
    'zh-Hans': '公开查询',
    'zh-Hant': '公開查詢',
  },
  公开表单: {
    en: 'Public Form',
    ja: '公開フォーム',
    'zh-Hans': '公开表单',
    'zh-Hant': '公開表單',
  },
  记录分享: {
    en: 'Record Sharing',
    ja: '記録共有',
    'zh-Hans': '记录分享',
    'zh-Hant': '記錄分享',
  },
  统计图分享: {
    en: 'Statistics Chart Sharing',
    ja: '統計チャート共有',
    'zh-Hans': '统计图分享',
    'zh-Hant': '統計圖分享',
  },
  升级版本: {
    en: 'Upgrade Version',
    ja: 'バージョンアップグレード',
    'zh-Hans': '升级版本',
    'zh-Hant': '升級版本',
  },
  合同: {
    en: 'Contract',
    ja: '契約',
    'zh-Hans': '合同',
    'zh-Hant': '合同',
  },
  视图分享: {
    en: 'View Sharing',
    ja: 'ビュー共有',
    'zh-Hans': '视图分享',
    'zh-Hant': '視圖分享',
  },
  微信授权: {
    en: 'WeChat Authorization',
    ja: 'WeChat認証',
    'zh-Hans': '微信授权',
    'zh-Hant': '微信授權',
  },
  流程链接: {
    en: 'Process Link',
    ja: 'プロセスリンク',
    'zh-Hans': '流程链接',
    'zh-Hant': '流程鏈接',
  },
  API文档: {
    en: 'API Documentation',
    ja: 'APIドキュメント',
    'zh-Hans': 'API文档',
    'zh-Hant': 'API文檔',
  },
  '403 ，抱歉禁止访问！': {
    en: '403, Sorry, Access Forbidden!',
    ja: '403、申し訳ありませんが、アクセスが禁止されています！',
    'zh-Hans': '403 ，抱歉禁止访问！',
    'zh-Hant': '403 ，抱歉禁止訪問！',
  },
  绑定微信登录: {
    en: 'Bind WeChat Login',
    ja: 'WeChatログインをバインド',
    'zh-Hans': '绑定微信登录',
    'zh-Hant': '綁定微信登入',
  },
  '加载中...': {
    en: 'Loading...',
    ja: '読み込み中...',
    'zh-Hans': '加载中...',
    'zh-Hant': '加載中...',
  },
  '绑定后，可直接使用微信扫描二维码登录': {
    en: 'After Binding, You Can Directly Use WeChat to Scan the QR Code to Login',
    ja: 'バインド後、WeChatを使用してQRコードをスキャンしてログインできます',
    'zh-Hans': '绑定后，可直接使用微信扫描二维码登录',
    'zh-Hant': '綁定後，可直接使用微信掃描二維碼登入',
  },
  应用库: {
    en: 'Application Library',
    ja: 'アプリケーションライブラリ',
    'zh-Hans': '应用库',
    'zh-Hant': '應用庫',
  },
  你即将进入: {
    en: 'You Are About to Enter',
    ja: 'あなたはまもなく入ります',
    'zh-Hans': '你即将进入',
    'zh-Hant': '你即將進入',
  },
  立即进入: {
    en: 'Enter Now',
    ja: '今すぐ入る',
    'zh-Hans': '立即进入',
    'zh-Hant': '立即進入',
  },
  添加服务到桌面: {
    en: 'Add Service to Desktop',
    ja: 'サービスをデスクトップに追加',
    'zh-Hans': '添加服务到桌面',
    'zh-Hant': '添加服務到桌面',
  },
  点击下方工具栏上的: {
    en: 'Click on the Toolbar Below',
    ja: '下のツールバーをクリック',
    'zh-Hans': '点击下方工具栏上的',
    'zh-Hant': '點擊下方工具欄上的',
  },
  并选择: {
    en: 'And Select',
    ja: 'そして選択',
    'zh-Hans': '并选择',
    'zh-Hant': '並選擇',
  },
  添加到主屏幕: {
    en: 'Add to Home Screen',
    ja: 'ホーム画面に追加',
    'zh-Hans': '添加到主屏幕',
    'zh-Hant': '添加到主屏幕',
  },
  第一步: {
    en: 'Step 1',
    ja: 'ステップ1',
    'zh-Hans': '第一步',
    'zh-Hant': '第一步',
  },
  '：点击底部工具': {
    en: ': Click the Bottom Tool',
    ja: ': 底部ツールをクリック',
    'zh-Hans': '：点击底部工具',
    'zh-Hant': '：點擊底部工具',
  },
  第二步: {
    en: 'Step 2',
    ja: 'ステップ2',
    'zh-Hans': '第二步',
    'zh-Hant': '第二步',
  },
  '：在弹出框中点击“添加到主屏幕”': {
    en: ': Click "Add to Home Screen" in the Pop-up Box',
    ja: ': ポップアップボックスで「ホーム画面に追加」をクリック',
    'zh-Hans': '：在弹出框中点击“添加到主屏幕”',
    'zh-Hant': '：在彈出框中點擊“添加到主屏幕”',
  },
  升级浏览器: {
    en: 'Upgrade Browser',
    ja: 'ブラウザをアップグレード',
    'zh-Hans': '升级浏览器',
    'zh-Hant': '升級瀏覽器',
  },
  '您的浏览器太古老了，该升级了~': {
    en: 'Your Browser is Too Old, It Needs to be Upgraded~',
    ja: 'あなたのブラウザは古すぎます、アップグレードが必要です~',
    'zh-Hans': '您的浏览器太古老了，该升级了~',
    'zh-Hant': '您的瀏覽器太古老了，該升級了~',
  },
  谷歌浏览器: {
    en: 'Google Chrome',
    ja: 'Google Chrome',
    'zh-Hans': '谷歌浏览器',
    'zh-Hant': '谷歌瀏覽器',
  },
  火狐浏览器: {
    en: 'Firefox',
    ja: 'Firefox',
    'zh-Hans': '火狐浏览器',
    'zh-Hant': '火狐瀏覽器',
  },
  Edge浏览器: {
    en: 'Edge Browser',
    ja: 'Edgeブラウザ',
    'zh-Hans': 'Edge浏览器',
    'zh-Hant': 'Edge瀏覽器',
  },
  客户端: {
    en: 'Client',
    ja: 'クライアント',
    'zh-Hans': '客户端',
    'zh-Hant': '客戶端',
  },
  下载失败: {
    en: 'Download Failed',
    ja: 'ダウンロード失敗',
    'zh-Hans': '下载失败',
    'zh-Hant': '下載失敗',
  },
  '没有权限，无法下载此附件': {
    en: 'No Permission to Download This Attachment',
    ja: 'この添付ファイルをダウンロードする権限がありません',
    'zh-Hans': '没有权限，无法下载此附件',
    'zh-Hant': '沒有權限，無法下載此附件',
  },
  法律门户: {
    en: 'Legal portal',
    ja: '法務ポータル',
    'zh-Hans': '法律门户',
    'zh-Hant': '法律門戶',
  },
  重置密码: {
    en: 'reset password',
    ja: 'パスワードをリセット',
    'zh-Hans': '重置密码',
    'zh-Hant': '重置密碼',
  },
  'HAP 私有部署版': {
    en: 'HAP Private',
    ja: 'HAPプライベート配備版',
    'zh-Hans': 'HAP 私有部署版',
    'zh-Hant': 'HAP 私有部署版',
  },
};

// 【仍然挂到全局】原先是经典脚本里的 `var staticLanguages`，等于一个全局。
// 打包成 IIFE 后作用域是闭合的，这里显式挂回去，免得将来有页面直接读它。
(window as any).staticLanguages = staticLanguages;

/** 选语言：cookie 优先，其次按浏览器语言归一，最后兜底英文 */
function detectLang(): LangTag {
  const cookieMatch = document.cookie.match(new RegExp('(^| )i18n_langtag=([^;]*)(;|$)'));

  if (cookieMatch) {
    // cookie 里可以是任何值；取不到译文时下面会自己回落到 en，所以这里断言是安全的
    return decodeURIComponent(cookieMatch[2]) as LangTag;
  }

  switch (navigator.language) {
    case 'zh-CN':
    case 'zh_cn':
    case 'zh-SG':
    case 'zh_sg':
      return 'zh-Hans';
    case 'zh-TW':
    case 'zh-HK':
    case 'zh-Hant':
      return 'zh-Hant';
    case 'ja':
      return 'ja';
    default:
      return 'en';
  }
}

const lang = detectLang();

/**
 * 把元素里的中文原文换成当前语言。
 * 【取值顺序照搬原实现】content 属性优先于 innerHTML（<meta content> 这类要用前者）；
 * 查不到译文时【原样保留中文】，而不是留空。
 */
function transformFunc(elements: ArrayLike<Element>): void {
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const content = element.getAttribute('content') || element.innerHTML;
    const langMap = staticLanguages[content];

    element.innerHTML = langMap ? langMap[lang] || langMap.en || content : content;
  }
}

// 【title 要同步换】它在 <head> 里；等到 DOMContentLoaded 再换，标签页标题会先闪一下中文。
transformFunc(document.querySelectorAll('title'));

document.addEventListener('DOMContentLoaded', function () {
  transformFunc(document.querySelectorAll('transformLang'));
  // 页面 <body> 初始是 display:none，换完文案才放出来，避免闪原文
  document.body.style.display = 'block';
});
