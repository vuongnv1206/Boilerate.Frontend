import { createServer, request as upstreamRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Same-origin test preview: preserve response status, body, headers and Set-Cookie from Kestrel.
export async function startLivePreview({ backendUrl, port = 0 }) {
  const backend = new URL(backendUrl);
  if (backend.protocol !== 'http:' || backend.hostname !== '127.0.0.1') {
    throw new Error('The live preview only proxies its isolated loopback backend.');
  }
  const root = resolve(import.meta.dirname, '../dist/boilerate-admin/browser');
  await stat(resolve(root, 'index.html'));
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
  };
  const server = createServer(async (request, response) => {
    if (request.url === '/api' || request.url?.startsWith('/api/')) {
      const upstream = upstreamRequest(
        new URL(request.url, backend),
        { method: request.method, headers: { ...request.headers, host: backend.host } },
        (result) => {
          response.writeHead(result.statusCode ?? 502, result.headers);
          result.pipe(response);
        },
      );
      upstream.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end('Isolated API unavailable.');
      });
      request.on('aborted', () => upstream.destroy());
      request.pipe(upstream);
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      if (pathname === '/runtime-config.js') {
        // The built config can contain a local UI licence; preserve it while forcing same-origin API.
        const source = await readFile(resolve(root, 'runtime-config.js'), 'utf8');
        const payload = source.match(/Object\.freeze\((\{.*\})\)/u)?.[1];
        const config = payload ? JSON.parse(payload) : {};
        const bytes = `window.__BOILERATE_UI__ = Object.freeze(${JSON.stringify({ ...config, apiBaseUrl: '/api' })});\n`;
        response.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store' });
        response.end(bytes);
        return;
      }
      let file = resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(400).end();
        return;
      }
      try {
        if (!(await stat(file)).isFile()) throw new Error('Not a file');
      } catch {
        if (extname(pathname)) {
          response.writeHead(404).end();
          return;
        }
        file = resolve(root, 'index.html');
      }
      const bytes = await readFile(file);
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      response.writeHead(500).end('Unable to serve frontend build.');
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', accept);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((accept, reject) => {
        server.close((error) => (error ? reject(error) : accept()));
        server.closeAllConnections();
      }),
  };
}
