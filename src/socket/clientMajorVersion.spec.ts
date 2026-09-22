/**
 * socket.io-client 必须留在 2.x —— 这**不是**偷懒不升，是服务端协议不允许。
 *
 * 生产后端是厂商的 HAP 容器（mdpublic/mingdaoyun-hap），里面跑的是 socket.io 2.x，
 * 也就是 Engine.IO v3。我们改不了它。
 *
 * ── 怎么确认后端是 v3 的（2026-09-22 在生产上实测）────────────────────
 * 直接开裸 WebSocket 到 wss://<host>/mds2/?EIO=<n>&transport=websocket 抓包：
 *
 *   1. EIO=3 和 EIO=4 拿到的握手应答**一模一样**
 *      （同样的 sid 结构、pingInterval:4000、pingTimeout:15000）
 *      —— v3 服务端根本不看这个查询参数。
 *   2. 服务端**不等客户端**就主动发 `40`（命名空间 CONNECT）。
 *      socket.io 3/4 的服务端是反过来的：要等客户端先发 `40`。
 *   3. pingInterval 是 4000，但 6.5 秒里服务端**一个 ping 都没发**。
 *      Engine.IO v4 是服务端 ping、客户端 pong；v3 反过来由客户端发起。
 *
 * ── 升上去会怎样 ────────────────────────────────────────────────────
 * socket.io-client 从 3.x 起只会说 EIO=4，且客户端侧**没有**退回 v3 的开关
 * （`allowEIO3` 是服务端的选项，方向反了）。真升上去的表现是：
 * 握手看起来成功，然后一直等不到服务端的 ping，15 秒 pingTimeout 后判定断线、
 * 重连，**无限循环**。聊天、工作流推送、导入导出进度、自定义通知全部静默失效
 * —— 而且不抛异常，控制台只有连不上的重试。
 *
 * 所以 2.5.0 已经是**能和这个后端对话的最新版本**。
 * 哪天厂商把容器里的 socket.io 升到 3/4，再来改这条门禁。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../../scripts/spec-harness.ts');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declared = (pkg.dependencies || {})['socket.io-client'] || (pkg.devDependencies || {})['socket.io-client'];

assert.ok(declared, 'package.json 里找不到 socket.io-client');

const declaredMajor = (declared.match(/(\d+)/) || [])[1];

assert.strictEqual(
  declaredMajor,
  '2',
  `socket.io-client 声明成了 ${declared}，但生产后端是 socket.io 2.x（Engine.IO v3）。` +
    '3.x 起的客户端只说 EIO=4，会等不到服务端 ping 而无限重连，' +
    '聊天/工作流推送/导入导出进度/自定义通知会全部静默失效（判定依据见本文件头）。',
);

// 实际装上的也要对得上：只改 package.json 而 lock 没跟着走，等于没生效
const installed = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'node_modules/socket.io-client/package.json'), 'utf8'),
).version;

assert.strictEqual(
  installed.split('.')[0],
  '2',
  `node_modules 里装的是 socket.io-client ${installed}，和声明的 2.x 对不上`,
);

console.log(`socket.io-client major version test passed（声明 ${declared}，实装 ${installed}）`);
