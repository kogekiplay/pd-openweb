/**
 * 验证页的静态服务。用仓里已有的 serve-handler，不引入新依赖。
 * file: 协议下浏览器窗格会把页面当静态快照、不执行脚本，所以必须走 HTTP。
 */
const http = require('http');
const path = require('path');
const handler = require('serve-handler');

const PORT = Number(process.env.JQ_VERIFY_PORT || 5601);
const root = path.join(__dirname, 'dist');

http
  .createServer((req, res) => handler(req, res, { public: root }))
  .listen(PORT, () => console.log(`jQuery 修复验证页: http://localhost:${PORT}/`));
