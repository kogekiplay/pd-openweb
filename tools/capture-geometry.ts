/**
 * 把 tools/geometry-probe.ts 变成可以直接粘进浏览器控制台的一段源码。
 *
 *   node tools/capture-geometry.ts                      # 打到 stdout，自己复制
 *   node tools/capture-geometry.ts --clip               # 直接进剪贴板（macOS）
 *   node tools/capture-geometry.ts --sink <out.json>    # 起接收端，粘贴后自动落盘
 *
 * 【为什么要这一步而不是手工复制】探针文件是 .ts（为了进类型门禁），
 * 开头有 `export`，结尾没有调用 —— 直接粘进控制台是 `SyntaxError: Unexpected token 'export'`。
 * 手工删两处每次都要记，而且**删错了控制台只报语法错，不会告诉你少了什么**。
 *
 * 【为什么要 --sink】一页 1000+ 个元素，JSON 有 100KB 量级。
 * 靠控制台回显再手工复制粘贴到文件，既容易截断也没法自动化。
 * `--sink` 起一个只活一次的本地接收端，粘进去的代码采完直接 POST 过来落盘。
 * **必须开 CORS** —— 页面在 localhost:30001（或生产域），接收端在另一个端口，
 * 不加响应头的话浏览器会拦掉，而且控制台报的是网络错、不会告诉你是跨域。
 *
 * 探针本身必须是纯 JS 语法（不能有类型标注），理由见 geometry-probe.ts 文件头。
 * 这里不做任何转译 —— 一旦需要转译，就说明那条约束已经破了，应该去修探针而不是加编译。
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const SINK_PORT = 30099;

const PROBE = path.join(__dirname, 'geometry-probe.ts');
const source: string = fs.readFileSync(PROBE, 'utf8');

if (/:\s*(string|number|boolean|any|void|unknown)\b/.test(source.replace(/\/\*[\s\S]*?\*\//g, ''))) {
  console.error('探针里出现了类型标注 —— 粘进控制台会语法错。去掉标注，别在这里加转译。');
  process.exit(1);
}

// 探针是 async（要隔一会儿采两次证明页面静止），所以调用处要 await。
// 控制台和本仓的浏览器工具都支持顶层 await。
const payload =
  source.replace(/^export\s+async\s+function/m, 'async function').trimEnd() +
  '\n\nJSON.stringify(await captureGeometry());\n';

const sinkIdx = process.argv.indexOf('--sink');

if (sinkIdx !== -1) {
  const outFile: string = process.argv[sinkIdx + 1];
  if (!outFile) {
    console.error('--sink 后面要跟输出文件路径');
    process.exit(2);
  }

  // 采完直接 POST 过来，不走控制台回显
  const posting =
    payload.replace(/\nJSON\.stringify\(await captureGeometry\(\)\);\n$/, '') +
    `
await fetch('http://127.0.0.1:${SINK_PORT}/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(await captureGeometry()),
}).then(r => r.text());
`;

  const server = http.createServer((req, res) => {
    // 见文件头：不加这三个头，浏览器会以网络错的形式静默拦掉
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    let body = '';
    req.on('data', (c: any) => (body += c));
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
        fs.writeFileSync(outFile, JSON.stringify(json, null, 0) + '\n');
        res.writeHead(200).end('ok');
        console.error(`收到快照：${json.meta.元素数} 个元素，漂移 ${json.meta.采集间漂移元素数} -> ${outFile}`);
      } catch (err: any) {
        res.writeHead(400).end('bad');
        console.error('收到的不是合法快照：' + err.message);
      }
      server.close();
    });
  });

  server.listen(SINK_PORT, '127.0.0.1', () => {
    console.error(`接收端已就绪（127.0.0.1:${SINK_PORT}，只收一次）。把下面这段粘进目标页面控制台：\n`);
    process.stdout.write(posting);
  });
} else if (process.argv.includes('--clip')) {
  execSync('pbcopy', { input: payload });
  console.error(`已复制到剪贴板（${payload.length} 字符）。在目标页面控制台粘贴执行。`);
} else {
  process.stdout.write(payload);
}
