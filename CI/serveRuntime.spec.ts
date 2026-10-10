import type { IncomingMessage, ServerResponse } from 'node:http';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const http: typeof import('node:http') = require('node:http');
const { once } = require('node:events');
const path: typeof import('node:path') = require('node:path');
const { transformSync } = require('../scripts/spec-harness.ts');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
interface WsClient {
  on(event: 'message', callback: (message: Buffer) => void): void;
  close(): void;
}
interface WsServer {
  on(event: 'connection', callback: (socket: { send(value: string): void }) => void): void;
  on(event: 'listening', callback: () => void): void;
  address(): import('node:net').AddressInfo;
  close(): void;
}
interface WsModule {
  new (url: string): WsClient;
  Server: new (options: { port: number }) => WsServer;
}
const ws: WsModule = require('ws');

interface ProxyHandler {
  (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
  upgrade(req: IncomingMessage, socket: import('node:stream').Duplex, head: Buffer): void;
}
interface Runtime {
  rewriteAbsoluteHosts(buffer: Buffer, server: string, prefixes?: readonly string[]): Buffer | string;
  makeProxy(config: {
    name: string;
    server: string;
    path: string;
    replace: string;
    rewriteHosts?: boolean | string[];
  }): ProxyHandler;
}
interface ServerHandle {
  server: import('node:http').Server;
  port: number;
}
function startServer(handler: import('node:http').RequestListener): Promise<ServerHandle> {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  return once(server, 'listening').then(() => ({
    server,
    port: (server.address() as import('node:net').AddressInfo).port,
  }));
}
async function body(response: Response): Promise<string> {
  return response.text();
}
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(__dirname, 'serve.ts');
const source = `${require('node:fs').readFileSync(sourcePath, 'utf8')}\nmodule.exports.__runtime = { rewriteAbsoluteHosts, makeProxy };`;
const compiled = transformSync(source, {
  filename: sourcePath,
  babelrc: false,
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code.replace(
  /module\.exports = serve;\s*$/,
  'module.exports.__runtime = { rewriteAbsoluteHosts, makeProxy }; module.exports = Object.assign(serve, { __runtime: module.exports.__runtime });',
);
const product: { exports: { __runtime?: Runtime } } = { exports: {} };
const localRequire = createRequire(sourcePath);
new Function('module', 'exports', 'require', '__dirname', '__filename', compiled)(
  product,
  product.exports,
  localRequire,
  __dirname,
  sourcePath,
);
assert.ok(product.exports.__runtime);
const runtime = product.exports.__runtime;

(async () => {
  const target = await startServer((req, res) => {
    if (req.url === '/json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({ icon: 'http://127.0.0.1:1/file/mdpub/icon.svg', document: 'http://127.0.0.1:1/file/mdoc/a' }),
      );
      return;
    }
    if (req.url === '/sse') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: http://127.0.0.1:1/file/mdpub/icon.svg\n\n');
      return;
    }
    res.writeHead(404);
    res.end('missing');
  });
  const proxy = await startServer((req, res) => {
    const middleware = runtime.makeProxy({
      name: 'fixture',
      server: `http://127.0.0.1:${target.port}`,
      path: '/fixture/',
      replace: '/',
      rewriteHosts: true,
    });
    void middleware(req, res, () => {
      res.writeHead(404);
      res.end('next');
    });
  });
  try {
    const direct = runtime.rewriteAbsoluteHosts(
      Buffer.from(
        JSON.stringify({
          icon: `http://host.example/file/mdpub/icon.svg`,
          mdoc: `http://host.example/file/mdoc/a`,
          nested: `https://other.example/file/mdpic/a`,
        }),
      ),
      `http://host.example`,
      ['/file/mdpub', '/file/mdoc', '/file/mdpic', '/'],
    );
    assert.equal(Buffer.isBuffer(direct), false);
    assert.equal(
      direct,
      JSON.stringify({ icon: '/file/mdpub/icon.svg', mdoc: '/file/mdoc/a', nested: '/file/mdpic/a' }),
    );
    const unchanged = runtime.rewriteAbsoluteHosts(Buffer.from('plain'), '/wwwapi/');
    assert.ok(Buffer.isBuffer(unchanged));
    assert.equal(unchanged.toString(), 'plain');
    const json = await fetch(`http://127.0.0.1:${proxy.port}/fixture/json`);
    assert.equal(json.status, 200);
    const jsonText = await body(json);
    assert.ok(jsonText.includes('/file/mdpub/icon.svg'));
    assert.ok(
      jsonText.includes('file/mdoc/a') && jsonText.includes('http://127.0.0.1:1/file/mdoc/a'),
      'document host remains untouched',
    );
    const sse = await fetch(`http://127.0.0.1:${proxy.port}/fixture/sse`);
    assert.equal(sse.headers.get('content-type'), 'text/event-stream');
    assert.equal(
      await body(sse),
      'data: http://127.0.0.1:1/file/mdpub/icon.svg\n\n',
      'SSE is streamed through without rewrite buffering',
    );
    const badProxy = await startServer((req, res) => {
      const middleware = runtime.makeProxy({
        name: 'bad',
        server: 'http://127.0.0.1:1',
        path: '/bad/',
        replace: '/',
        rewriteHosts: false,
      });
      void middleware(req, res, () => {
        res.writeHead(404);
        res.end();
      });
    });
    try {
      const bad = await fetch(`http://127.0.0.1:${badProxy.port}/bad/error`);
      assert.equal(bad.status, 502);
      assert.equal(await body(bad), 'Bad gateway');
    } finally {
      badProxy.server.close();
    }
    const staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hap-serve-static-'));
    fs.writeFileSync(path.join(staticRoot, 'fixture.txt'), 'static fixture');
    const staticServer = await startServer((req, res) => {
      const handler = require('serve-handler');
      void handler(req, res, { public: staticRoot });
    });
    try {
      const staticResponse = await fetch(`http://127.0.0.1:${staticServer.port}/fixture.txt`);
      assert.equal(staticResponse.status, 200);
      assert.equal(await body(staticResponse), 'static fixture');
    } finally {
      staticServer.server.close();
      fs.rmSync(staticRoot, { recursive: true, force: true });
    }
    const wsTarget = new ws.Server({ port: 0 });
    wsTarget.on('connection', (socket: { send(value: string): void }) => socket.send('ws-ok'));
    await once(wsTarget, 'listening');
    const wsPort = (wsTarget.address() as import('net').AddressInfo).port;
    const wsMiddleware = runtime.makeProxy({
      name: 'ws-fixture',
      server: `http://127.0.0.1:${wsPort}`,
      path: '/ws/',
      replace: '/',
      rewriteHosts: false,
    });
    const wsServer = http.createServer((req, res) => {
      void wsMiddleware(req, res, () => {
        res.writeHead(404);
        res.end();
      });
    });
    wsServer.on('upgrade', (req, socket, head) => wsMiddleware.upgrade(req, socket, head));
    await once(wsServer.listen(0, '127.0.0.1'), 'listening');
    const wsPortLocal = (wsServer.address() as import('net').AddressInfo).port;
    try {
      const socket = new ws(`ws://127.0.0.1:${wsPortLocal}/ws/`);
      const [message] = await once(socket, 'message');
      assert.equal(message.toString(), 'ws-ok');
      socket.close();
    } finally {
      wsServer.close();
      wsTarget.close();
    }
    console.log(
      'Actual serve source HTTP proxy, JSON host rewriting, mdoc preservation, SSE passthrough and proxy error lifecycle passed',
    );
  } finally {
    proxy.server.close();
    target.server.close();
  }
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
