// Static server for browser tests and the parity gate; 404s mirror GitHub Pages.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

async function file(root, urlPath) {
  let p = resolve(root, '.' + decodeURIComponent(urlPath));
  if (p !== root && !p.startsWith(root + sep)) return null;
  try {
    if ((await stat(p)).isDirectory()) p = join(p, 'index.html');
    return { body: await readFile(p), type: TYPES[extname(p)] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}

export function serve(dir, port = 0) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const f = await file(root, new URL(req.url, 'http://x').pathname);
    if (f) return res.writeHead(200, { 'content-type': f.type }).end(f.body);
    const nf = await file(root, '/404.html');
    res.writeHead(404, { 'content-type': TYPES['.html'] }).end(nf?.body ?? 'Not found');
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () => new Promise((done) => { server.closeAllConnections(); server.close(done); }),
  })));
}

if (import.meta.main) {
  const s = await serve(process.argv[2] ?? 'dist', Number(process.argv[3] ?? 4321));
  console.log(s.url);
}
