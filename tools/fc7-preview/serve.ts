/**
 * 预览页的静态服务。用仓里已有的 serve-handler，不引入新依赖。
 * file: 协议下浏览器窗格会把页面当静态快照、不执行脚本，所以必须走 HTTP。
 */
const http = require('http');
const path = require('path');
const handler = require('serve-handler');

const PORT = Number(process.env.FC_PREVIEW_PORT || 5599);
const root = path.join(__dirname, 'dist');

http
  .createServer((req, res) => handler(req, res, { public: root }))
  .listen(PORT, () => console.log(`fc7 预览: http://localhost:${PORT}/`));
