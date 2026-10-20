import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../dist/boilerate-admin/browser');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
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
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(bytes);
  } catch {
    response.writeHead(500).end('Unable to serve frontend build.');
  }
});
server.listen(4300, '127.0.0.1', () => console.log('Frontend preview http://127.0.0.1:4300'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
